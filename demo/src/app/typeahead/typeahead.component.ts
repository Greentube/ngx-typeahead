import {
  Component, forwardRef, Input, OnDestroy, ElementRef, Output,
  EventEmitter, AfterViewInit, Inject, OnInit, Renderer2, HostListener
} from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/from';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/toArray';
import 'rxjs/add/operator/filter';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TypeaheadSettings, TypeaheadSuggestions } from './typeahead.interface';

const KEY_UP = 'keyup';
const KEY_DOWN = 'keydown';

/**
 * Sanitize string for string comparison
 * @param {string} text
 */
const sanitizeString = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/***
 * Usage:
 *
 * <typeahead formControlName="myControlName" [suggestions]="['abc', 'def',...]"></typeahead>
 * <typeahead formControlName="myControlName" [suggestions]="Observable.of(['abc', 'def',...])"></typeahead>
 */
@Component({
  selector: 'typeahead',
  template: `
    <span [ngClass]="settings.tagClass" class="typeahead-badge" *ngFor="let tag of []">
      {{ tag }}
      <span *ngIf="!isDisabled" aria-hidden="true" (click)="removeValue(tag)"
            [ngClass]="settings.tagRemoveIconClass">×</span>
    </span>
    <input *ngIf="!isDisabled || !multi" [disabled]="isDisabled || null"
           type="text" autocomplete="off"
           (keyup)="handleInput($event)"
           (keydown)="handleInput($event)"
           (paste)="handleInput($event)"
           (click)="toggleDropdown($event, true)"/>
    <i *ngIf="!isDisabled" (click)="toggleDropdown($event)"
       [ngClass]="settings.dropdownToggleClass"></i>
    <div role="menu" [ngClass]="isExpanded ? settings.dropdownMenuExpandedClass : settings.dropdownMenuClass">
      <button *ngFor="let match of matches" type="button" role="menuitem"
              [ngClass]="settings.dropdownMenuItemClass"
              (mouseup)="setValue(match)"
              (keydown)="handleButton($event, match)"
              (keyup)="handleButton($event, match)">
        {{ match }}
      </button>
      <div role="menuitem" *ngIf="!matches.length && !custom"
           [ngClass]="settings.dropdownMenuItemClass">
        {{ settings.noMatchesText }}
      </div>
    </div>
  `,
  styleUrls: ['./typeahead.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TypeaheadComponent), multi: true }],
  host: {
    '[attr.disabled]': 'isDisabled || null'
  }
})
export class TypeaheadComponent implements ControlValueAccessor, AfterViewInit, OnDestroy, OnInit {
  /** suggestions list - array of strings, objects or Observable */
  @Input() suggestions: TypeaheadSuggestions = [];
  /** template for items in drop down */
  // @Input() public suggestionTemplate: TemplateRef<any>;
  /** field to use from objects as name */
  @Input() nameField: string = 'name';
  /** field to use from objects as id */
  @Input() idField: string = 'id';
  /** allow custom values */
  @Input() custom: boolean = true;
  /** allow multiple values */
  @Input() multi: boolean = false;

  /** Value of form control */
  @Input()
  set settings(value: TypeaheadSettings) {
    Object.assign(this._settings, value);
  }

  get settings(): TypeaheadSettings {
    return this._settings;
  }

  /** Output value change */
  @Output() valueChange = new EventEmitter();

  // ui state
  isDisabled: boolean = false;
  isExpanded: boolean = false;
  matches: string[] | Object[] = [];

  private _settings: TypeaheadSettings = {
    suggestionsLimit: 10,
    typeDelay: 50,
    noMatchesText: 'No matches found',

    tagClass: 'btn badge badge-primary',
    tagRemoveIconClass: 'close',
    dropdownMenuClass: 'dropdown-menu',
    dropdownMenuExpandedClass: 'dropdown-menu show',
    dropdownMenuItemClass: 'dropdown-item',
    dropdownToggleClass: 'dropdown-toggle'
  };
  private _input: HTMLInputElement;
  private _inputChangeEvent: EventEmitter<any> = new EventEmitter();
  private _value: any; // TODO: Check value

  /**
   * CTOR
   * @param elementRef
   * @param renderer
   */
  constructor(@Inject(ElementRef) private elementRef: ElementRef, @Inject(Renderer2) private renderer: Renderer2) {
  }

  @HostListener('focusout', ['$event'])
  focusOutHandler(event: any) {
    if (event.relatedTarget) {
      // related target is typeahead, input or one of the buttons
      if (event.relatedTarget === this.elementRef.nativeElement ||
        event.relatedTarget.parentElement === this.elementRef.nativeElement ||
        event.relatedTarget.parentElement.parentElement === this.elementRef.nativeElement) {

        // grab back input focus after button click since `focus out` cancelled it
        if (event.target === this._input && event.relatedTarget === this.elementRef.nativeElement) {
          this._input.focus();
        }
        return;
      }
    }
    // close dropdown
    this.isExpanded = false;

    // if not match then cleanup the values
    if (!this.custom && !this.hasMatch(this._input.value)) {
      this._input.value = this.value = null;
      this._inputChangeEvent.emit('');
      return;
    }
    // keep just approved tags
    if (this.multi) {
      this._input.value = null;
      this._inputChangeEvent.emit('');
    }
  }

  /**
   * On component initialization
   */
  ngOnInit() {
    if (this.suggestions instanceof Observable) {
      this.asyncSuggestionsInit();
    } else if (this.suggestions.length) {
      this.syncSuggestionsInit();
    }
    this._inputChangeEvent.emit('');
  }

  syncSuggestionsInit() {
    this._inputChangeEvent
      .debounceTime(this.settings.typeDelay)
      .mergeMap((value: string) => {
        const normalizedValue = sanitizeString(value);
        return Observable.from(this.suggestions)
          .filter(this.filterSuggestion(normalizedValue))
          .take(this.settings.suggestionsLimit)
          .toArray();
        // TODO: filter existing values
      }).subscribe((matches: string[] | Object[]) => {
      this.matches = matches;
    }, () => {
      // TODO: what kind of error?
    });
  }

  asyncSuggestionsInit() {
  }

  /**
   * Init method
   */
  ngAfterViewInit() {
    // set value to input
    this._input = this.elementRef.nativeElement.querySelector('input');
    if (!this.multi && this._value) {
      this._input.value = this._value;
    }
  }

  /**
   * Cleanup timeout
   */
  ngOnDestroy(): void {
  }

  /**
   * Value getter
   * @returns {string|string[]}
   */
  get value(): string | string[] {
    return this._value;
  }

  /**
   * Value setter
   * @param value
   */
  set value(value: string | string[]) {
    if (value === this._value) {
      return;
    }
    this.writeValue(value);
  }

  /**
   * Update value on input change
   * @param event
   */
  handleInput(event: Event | KeyboardEvent) {
    const target = (event.target as HTMLInputElement);

    this.isExpanded = true;

    if (this.multi) {
      // TODO:...
    } else if (event.type === KEY_UP) {
      this.setValue(target.value);
    }
    console.log(event.type, [KEY_DOWN, KEY_UP].includes(event.type));
    // if arrow down, select first item in the menu
    if ([KEY_DOWN, KEY_UP].includes(event.type) && (event as KeyboardEvent).keyCode === 40 && this.matches.length > 0) {
      const button = this.elementRef.nativeElement.querySelector('button[role="menuitem"]:first-child');
      button.focus();
    }
    // if esc key, close dropdown
    if ([KEY_DOWN, KEY_UP].includes(event.type) && (event as KeyboardEvent).keyCode === 27) {
      this.isExpanded = false;
      this._input.focus();
    }
    this._inputChangeEvent.emit(target.value);
  }

  /**
   * Move through collection on arrow commands
   * @param event
   * @param value
   */
  handleButton(event: KeyboardEvent, value: string) {
    const target = (event.target as HTMLButtonElement);

    if (event.type === KEY_DOWN) {
      if (event.keyCode === 13 && target.nextElementSibling) {  // enter
        this.setValue(value);
      }
      if (event.keyCode === 40 && target.nextElementSibling) {  // arrow down
        (<HTMLElement>target.nextElementSibling).focus();
      }
      if (event.keyCode === 38 && target.previousElementSibling) { // arrow up
        (<HTMLElement>target.previousElementSibling).focus();
      }
      if (event.keyCode === 27) { // escape key
        this.isExpanded = false;
        this._input.focus();
      }
    } else { // scroll to parent
      (<HTMLElement>target.parentNode).scrollTop = target.offsetTop;
    }
  }

  setValue(value: string) {
    this.value = value;
    this._input.value = value;

    if (!this.custom && !this.hasMatch(this._input.value)) {
      return;
    }

    if (this.multi) {
      // ...
    } else {
      this.value = value;
      this._input.value = value;
      this._inputChangeEvent.emit(value);
    }

    // collapse menu on selection
    this.isExpanded = false;
    // refocus the input
    this._input.focus();
  }

  removeValue(value: string) {
    // TODO: Check...
    this._input.focus();
    this._inputChangeEvent.emit('');
  }

  toggleDropdown(event: Event, value?: boolean) {
    this.isExpanded = (value !== undefined) ? value : !this.isExpanded;
  }

  /**
   * Write new value
   * @param value
   */
  writeValue(value: any): void { // TODO: Check the type
    this._value = value;
    this.elementRef.nativeElement.value = value;
    this.triggerOnChange(this.elementRef.nativeElement); // trigger on change event
    this.onChange(value);
  }

  setDisabledState(value: boolean): void {
    this.isDisabled = value;
    this.renderer.setProperty(this.elementRef.nativeElement, 'disabled', value);
  }

  onChange = (_: any) => { /**/
  };
  onTouched = () => { /**/
  };

  registerOnChange(fn: (_: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * Trigger onChange event on native element
   * @param {EventTarget} element
   */
  private triggerOnChange(element: EventTarget) {
    // if standard (non IE) browser
    if ('createEvent' in document) {
      let evt = document.createEvent('HTMLEvents');
      evt.initEvent('change', false, true);
      element.dispatchEvent(evt);
    } else {
      // we need to cast since fireEvent is not standard functionality and works only in IE
      (<any> element).fireEvent('onchange');
    }
  }

  private filterSuggestion(filter: string) {
    return (value: string | Object): boolean => {
      if (typeof value === 'string') {
        return sanitizeString(value).includes(filter);
      } else {
        return sanitizeString(value[this.nameField]).includes(filter);
      }
    };
  }

  private hasMatch(value: string): boolean {
    for (let match in this.matches) {
      if (typeof match === 'string' && match === value) {
        return true;
      } else if (match[this.nameField] === value) {
        return true;
      }
    }
    return false;
  }
}
