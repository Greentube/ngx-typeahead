import {
  Component, forwardRef, Input, OnDestroy, ElementRef, Output,
  EventEmitter, AfterViewInit, Inject, OnInit, Renderer2, HostListener, HostBinding
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
const ARROW_DOWN = 'ArrowDown';
const ARROW_UP = 'ArrowUp';
const ESCAPE = 'Escape';
const ENTER = 'Enter';
const BACKSPACE = 'Backspace';

/**
 * Sanitize string for string comparison
 * @param {string} text
 */
const sanitizeString = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/***
 * Usage:
 *
 * <typeahead formControlName="myControlName" [suggestions]="['abc', 'def',...]"></typeahead>
 * <typeahead formControlName="myControlName" [suggestions]="Observable.of(['abc', 'def',...])"></typeahead>
 */
@Component({
  selector: 'type-ahead',
  styles: [`
    :host {
      height: auto;
      min-height: 1em;
      position: relative;
      display: inline-flex;
      flex-wrap: wrap;
      border-width: thin;
      border-style: inset;
      border-color: initial;
      -webkit-appearance: textfield;
      -webkit-rtl-ordering: logical;
      user-select: text;
      cursor: auto;
    }
    :host[disabled] {
      cursor: not-allowed;
    }
    :host[disabled] input {
      background-color: inherit;
    }
    :host .typeahead-badge {
      white-space: nowrap;
    }
    :host input {
      border: none;
      outline: 0;
      line-height: 1;
      flex: 1;
    }
  `],
  template: `
    <span [ngClass]="settings.tagClass" class="typeahead-badge" *ngFor="let value of values">
      {{ complex ? value[nameField] : value }}
      <span *ngIf="!isDisabled" aria-hidden="true" (click)="removeValue(value)"
            [ngClass]="settings.tagRemoveIconClass">×</span>
    </span>
    <input *ngIf="!isDisabled || !multi || !values.length" [disabled]="isDisabled || null"
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
              (mouseup)="handleButton($event, match)"
              (keydown)="handleButton($event, match)"
              (keyup)="handleButton($event, match)">
        {{ complex ? match[nameField] : match }}
      </button>
      <div role="menuitem" *ngIf="!matches.length && !custom"
           [ngClass]="settings.dropdownMenuItemClass">
        {{ settings.noMatchesText }}
      </div>
    </div>
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TypeaheadComponent), multi: true }]
})
export class TypeaheadComponent implements ControlValueAccessor, AfterViewInit, OnDestroy, OnInit {
  /** suggestions list - array of strings, objects or Observable */
  @Input() suggestions: TypeaheadSuggestions = [];
  /** template for items in drop down */
  // @Input() public suggestionTemplate: TemplateRef<any>;
  /** field to use from objects as name */
  @Input() nameField = 'name';
  /** field to use from objects as id */
  @Input() idField = 'id';
  /** allow custom values */
  @Input() custom = true;
  /** allow multiple values */
  @Input() multi = false;
  /** use complex suggestions and results */
  @Input() complex = false;

  /** Value of form control */
  @Input()
  set settings(value: TypeaheadSettings) {
    Object.assign(this._settings, value);
  }

  get settings(): TypeaheadSettings {
    return this._settings;
  }

  /** UI Bindings */
  @HostBinding('class.multi') get multiBinding() { return this.multi; }
  @HostBinding('attr.disabled') get disabledBinding() { return this.isDisabled || null; }

  /** Output value change */
  @Output() valueChange = new EventEmitter();

  // ui state
  isDisabled = false;
  isExpanded = false;
  dropDownClass = '';
  matches: string[] | Object[] = [];
  allMatches: string[] | Object[] = [];

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

    // keep just approved tags
    if (this.multi) {
      this._input.value = null;
      this._inputChangeEvent.emit('');
      return;
    }

    // trim values
    if (!this.custom || this.complex) {
      this._input.value = this._input.value.trim();
      // if not match then cleanup the values
      if (!this.hasMatch(this._input.value)) {
        this._input.value = this.value = null;
        this._inputChangeEvent.emit('');
      }
    }
  }

  /**
   * On component initialization
   */
  ngOnInit() {
    this.suggestionsInit(this.suggestions instanceof Observable ?
      this.suggestions.mergeMap((value: any[]) => {
        return Observable.from(value);
      }) :
      Observable.from(this.suggestions));
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
    suggestion$.toArray().subscribe((suggestions: string[] | Object[]) => {
      this.allMatches = suggestions;
    });
  }

  /**
   * Init method
   */
  ngAfterViewInit() {
    // set value to input
    this._input = this.elementRef.nativeElement.querySelector('input');
    if (!this.multi && this._value) {
      this._input.value = this.complex ?
        this.extractNameFromMatches(this._value) :
        this._value;
    }
  }

  /**
   * Cleanup timeout
   */
  ngOnDestroy(): void {
    // TODO: cleanup subscriptions
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
    if ([KEY_DOWN, KEY_UP].includes(event.type) && (event as KeyboardEvent).key === ESCAPE) {
      this.toggleDropdown(false);
      return;
    }
    // if arrow down, select first item in the menu
    if (event.type === KEY_DOWN && (event as KeyboardEvent).key === ARROW_DOWN && this.matches.length > 0) {
      const button = this.elementRef.nativeElement.querySelector('button[role="menuitem"]:first-child');
      button.focus();
      return;
    }

    this.toggleDropdown(true);

    if (this.multi || this.complex) {
      if (event.type === KEY_UP && (event as KeyboardEvent).key === ENTER && target.value !== '') { // enter and value
        this.setValue(target.value);
        this.toggleDropdown(false);
      }
      if ([KEY_DOWN, KEY_UP].includes(event.type) && (event as KeyboardEvent).key === BACKSPACE) {
        if (target.value === '') { // backspace
          if (event.type === KEY_DOWN) {
            this._removeInProgress = true;
          } else if (this._removeInProgress) {
            if (this.multi && this.values.length) {
              this._removeInProgress = false;
              this.removeValue(this.values[this.values.length - 1]);
            }
          }
        } else if (this.complex && event.type === KEY_DOWN) {
          this.value = null;
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
  handleButton(event: KeyboardEvent | MouseEvent, value: any) {
    const target = (event.target as HTMLButtonElement);

    if (event instanceof MouseEvent) {
      this.setValue(value, true);
      this._inputChangeEvent.emit(this._input.value);
      return;
    }

    if (event.type === KEY_UP) {
      if (event.key === ENTER) {  // enter
        this.setValue(value);
        this._inputChangeEvent.emit(this._input.value);
        this.toggleDropdown(false);
      }
      if (event.key === ESCAPE) { // escape key
        this._input.focus();
        this.toggleDropdown(false);
      }
    } else { // scroll to parent
      if (event.key === ARROW_DOWN && target.nextElementSibling) {  // arrow down
        (<HTMLElement>target.nextElementSibling).focus();
      }
      if (event.key === ARROW_UP && target.previousElementSibling) { // arrow up
        (<HTMLElement>target.previousElementSibling).focus();
      }
      (<HTMLElement>target.parentNode).scrollTop = target.offsetTop;
    }
  }

  setValue(value: any, collapseMenu?: boolean) {
    if (!this.custom && !this.hasMatch(value)) {
      return;
    }

    if (this.multi) {
      if (!this.values.includes(value)) {
        this.value = this.values.concat(value).map(this.extractIdentifier.bind(this));
        this._input.value = '';
      }
    } else {
      this.value = this.extractIdentifier(value);
      this._input.value = this.extractName(value);
    }
    if (collapseMenu) {
      this.toggleDropdown(false);
    }
    // refocus the input
    this._input.focus();
  }

  removeValue(value: any) {
    const index = this.values.indexOf(value);
    if (index !== -1) {
      if (index === this.values.length - 1) {
        this.value = this.values.slice(0, -1).map(this.extractIdentifier.bind(this));
      } else {
        this.value = this.values.slice(0, index).concat(this.values.slice(index + 1)).map(this.extractIdentifier.bind(this));
      }
      this._input.focus();
    }
  }

  toggleDropdown(value?: boolean) {
    if (value === undefined) {
      this._input.focus();
      this.isExpanded = !this.isExpanded;
    } else {
      this.isExpanded = value;
    }
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

    // modify values list
    if (this.multi) {
      if (this.complex) {
        this.values = value ? value.map(this.extractObjectFromId.bind(this)) : [];
      } else {
        this.values = value || [];
      }
    }

    // trigger change
    if ('createEvent' in document) { // if standard (non IE) browser
      const event = document.createEvent('HTMLEvents');
      event.initEvent('change', false, true);
      this.elementRef.nativeElement.dispatchEvent(event);
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
    return (value: any): boolean => {
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
    for (const key in this.matches) {
      if (typeof this.matches[key] === 'string' && this.matches[key] === value) {
        return true;
      } else if ((<any> this.matches[key])[this.nameField] === value) {
        return true;
      }
    }
    return false;
  }

  private extractNameFromMatches(id: any) {
    const match = this.extractObjectFromId(id);
    if (match) {
      return match[this.nameField];
    } else {
      return '';
    }
  }

  private extractObjectFromId(id: any) {
    for (const key in this.allMatches) {
      if ((<any> this.allMatches[key])[this.idField] === id) {
        return this.allMatches[key];
      }
    }
    return null;
  }

  private extractIdentifier(value: any) {
    return this.complex ? value[this.idField] : value;
  }

  private extractName(value: any) {
    return this.complex ? value[this.nameField] : value;
  }
}
