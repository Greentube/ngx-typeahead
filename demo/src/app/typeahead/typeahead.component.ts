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
    <span [ngClass]="settings.tagClass" class="typeahead-badge" *ngFor="let value of values">
      {{ value }}
      <span *ngIf="!isDisabled" aria-hidden="true" (click)="removeValue(value)"
            [ngClass]="settings.tagRemoveIconClass">×</span>
    </span>
    <input *ngIf="!isDisabled || !multi" [disabled]="isDisabled || null"
           type="text" autocomplete="off"
           (keyup)="handleInput($event)"
           (keydown)="handleInput($event)"
           (paste)="handleInput($event)"
           (click)="toggleDropdown(true)"/>
    <i *ngIf="!isDisabled" (click)="toggleDropdown()"
       [ngClass]="settings.dropdownToggleClass"></i>
    <div role="menu" [attr.class]="dropDownClass">
      <button *ngFor="let match of matches" type="button" role="menuitem"
              [ngClass]="settings.dropdownMenuItemClass"
              (mouseup)="setValue(match, true)"
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
    '[attr.disabled]': 'isDisabled || null',
    '[class.multi]': 'multi'
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
  dropDownClass: string = '';
  matches: string[] | Object[] = [];

  // values
  values: any[] = [];

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
  private _value: any;
  private _removeInProgress = false;

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
    this.toggleDropdown(false);

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
    this.suggestionsInit(Observable.from(this.suggestions));
    this.toggleDropdown(false);
    this._inputChangeEvent.emit('');
  }

  suggestionsInit(suggestion$: Observable<any>) {
    this._inputChangeEvent
      .debounceTime(this.settings.typeDelay)
      .mergeMap((value: string) => {
        const normalizedValue = sanitizeString(value);
        return suggestion$
          .filter(this.filterSuggestion(normalizedValue))
          .take(this.settings.suggestionsLimit)
          .toArray();
      }).subscribe((matches: string[] | Object[]) => {
      this.matches = matches;
    });
  }

  /**
   * Init method
   */
  ngAfterViewInit() {
    // set value to input
    this._input = this.elementRef.nativeElement.querySelector('input');
    if (!this.multi && this._value) { // TODO: change for templates
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
  get value(): any {
    return this._value;
  }

  /**
   * Value setter
   * @param value
   */
  set value(value: any) {
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

    // if esc key, close dropdown
    if ([KEY_DOWN, KEY_UP].includes(event.type) && (event as KeyboardEvent).keyCode === 27) {
      this.toggleDropdown(false);
      return;
    }
    // if arrow down, select first item in the menu
    if (event.type === KEY_DOWN && (event as KeyboardEvent).keyCode === 40 && this.matches.length > 0) {
      const button = this.elementRef.nativeElement.querySelector('button[role="menuitem"]:first-child');
      button.focus();
      return;
    }

    this.toggleDropdown(true);

    if (this.multi) {
      if (event.type === KEY_UP && (event as KeyboardEvent).keyCode === 13 && target.value !== '') { // enter and value
        this.setValue(target.value);
        this.toggleDropdown(false);
      }
      if ([KEY_DOWN, KEY_UP].includes(event.type) && (event as KeyboardEvent).keyCode === 8 && target.value === '') { // backspace
        if (event.type === KEY_DOWN) {
          this._removeInProgress = true;
        } else if (this._removeInProgress && this.values.length) {
          this._removeInProgress = false;
          this.removeValue(this.values[this.values.length - 1]);
        }
      }
    } else if (event.type === KEY_UP) {
      this.setValue(target.value);
    }
    this._inputChangeEvent.emit(target.value);
  }

  /**
   * Move through collection on dropdown
   * @param event
   * @param value
   */
  handleButton(event: KeyboardEvent, value: string) {
    const target = (event.target as HTMLButtonElement);

    if (event.type === KEY_UP) {
      if (event.keyCode === 13) {  // enter
        this.setValue(value);
        this._inputChangeEvent.emit(this._input.value);
        this.toggleDropdown(false);
      }
      if (event.keyCode === 27) { // escape key
        this._input.focus();
        this.toggleDropdown(false);
      }
    } else { // scroll to parent
      if (event.keyCode === 40 && target.nextElementSibling) {  // arrow down
        (<HTMLElement>target.nextElementSibling).focus();
      }
      if (event.keyCode === 38 && target.previousElementSibling) { // arrow up
        (<HTMLElement>target.previousElementSibling).focus();
      }
      (<HTMLElement>target.parentNode).scrollTop = target.offsetTop;
    }
  }

  setValue(value: string, collapseMenu?: boolean) {
    this.value = value;
    this._input.value = value;

    if (!this.custom && !this.hasMatch(this._input.value)) {
      return;
    }

    if (this.multi) {
      if (!this.values.includes(value)) {
        this.values.push(value);
        this.value = this.values;
        this._input.value = '';
      }
    } else {
      this.value = value;
      this._input.value = value;
    }
    if (collapseMenu) {
      this.toggleDropdown(false);
    }
    // refocus the input
    this._input.focus();
  }

  removeValue(value: string) {
    const index = this.values.indexOf(value);
    if (index !== -1) {
      if (index === this.values.length - 1) {
        this.values.pop();
      } else {
        this.values.splice(index, 1);
      }
      this.value = this.values;

      this._input.focus();
    }
  }

  toggleDropdown(value?: boolean) {
    this.isExpanded = (value !== undefined) ? value : !this.isExpanded;
    this.dropDownClass = this.isExpanded ? this.settings.dropdownMenuExpandedClass : this.settings.dropdownMenuClass;
  }

  /**
   * Write new value
   * @param value
   */
  writeValue(value: any): void {
    // set value
    this._value = value;
    this.elementRef.nativeElement.value = value;

    // trigger change
    if ('createEvent' in document) { // if standard (non IE) browser
      let evt = document.createEvent('HTMLEvents');
      evt.initEvent('change', false, true);
      this.elementRef.nativeElement.dispatchEvent(evt);
    } else {
      // we need to cast since fireEvent is not standard functionality and works only in IE
      this.elementRef.nativeElement.fireEvent('onchange');
    }
    this.onChange(value);
  }

  setDisabledState(value: boolean): void {
    this.isDisabled = value;
    this.renderer.setProperty(this.elementRef.nativeElement, 'disabled', value);
  }

  onChange = (_: any) => { /**/ };
  onTouched = () => { /**/ };

  registerOnChange(fn: (_: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  private filterSuggestion(filter: string) {
    return (value: string | Object): boolean => {
      if (this.values.includes(value)) {
        return false;
      }
      if (typeof value === 'string') {
        return sanitizeString(value).includes(filter);
      } else {
        return sanitizeString(value[this.nameField]).includes(filter) && !this.values.includes(value);
      }
    };
  }

  private hasMatch(value: string): boolean {
    for (let key in this.matches) {
      if (typeof this.matches[key] === 'string' && this.matches[key] === value) {
        return true;
      } else if (this.matches[key][this.nameField] === value) {
        return true;
      }
    }
    return false;
  }
}
