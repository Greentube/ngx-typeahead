import {
  Component, forwardRef, Input, OnDestroy, ElementRef, Output, OnChanges,
  EventEmitter, AfterViewInit, Inject, OnInit, Renderer2, HostListener, HostBinding, SimpleChanges, TemplateRef
} from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/toArray';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/mergeAll';
import 'rxjs/add/operator/publishReplay';
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
      -webkit-appearance: textfield;
      -moz-appearance: textfield-multiline;
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
    :host .type-ahead-badge {
      white-space: nowrap;
      cursor: pointer;
    }
    :host input {
      border: none;
      outline: 0;
      line-height: 1;
      flex: 1;
    }
    :host [role="menuitem"] {
      cursor: pointer;
    }
    :host [role="menuitem"][disabled] {
      cursor: not-allowed;
    }
  `],
  template: `
    <!-- default options item template -->
    <ng-template #taItemTemplate let-value="item">
      {{ complex ? value[nameField] : value }}
    </ng-template>

    <span [ngClass]="settings.tagClass" class="type-ahead-badge" *ngFor="let value of values; let i = index">
      <ng-template [ngTemplateOutlet]="itemTemplate || taItemTemplate"
                 [ngTemplateOutletContext]="{ item: value, index: i, complex: complex, nameField: nameField }"></ng-template>
      <span *ngIf="!isDisabled" aria-hidden="true" (click)="removeValue(value)"
            [ngClass]="settings.tagRemoveIconClass">×</span>
    </span>
    <input *ngIf="!isDisabled || !multi || !values.length" [disabled]="isDisabled || null"
           type="text" autocomplete="off"
           (keyup)="handleInput($event)"
           (keydown)="handleInput($event)"
           (paste)="handleInput($event)"
           (click)="toggleDropdown(true)"/>
    <i *ngIf="!isDisabled" (click)="toggleDropdown()" tabindex="-1"
       [ngClass]="settings.dropdownToggleClass"></i>
    <div role="menu" [attr.class]="dropDownClass" *ngIf="matches.length || !custom">
      <button *ngFor="let match of matches; let i = index" type="button" role="menuitem" tabindex="-1"
              [ngClass]="settings.dropdownMenuItemClass"
              (mouseup)="handleButton($event, match)"
              (keydown)="handleButton($event, match)"
              (keyup)="handleButton($event, match)">
        <ng-template [ngTemplateOutlet]="itemTemplate || taItemTemplate"
                     [ngTemplateOutletContext]="{ item: match, index: i, complex: complex, nameField: nameField }"></ng-template>
      </button>
      <div role="menuitem" *ngIf="!matches.length && !custom" tabindex="-1" aria-disabled="true" disabled="true"
           [ngClass]="settings.dropdownMenuItemClass">
        {{ settings.noMatchesText }}
      </div>
    </div>
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TypeaheadComponent), multi: true }]
})
export class TypeaheadComponent implements ControlValueAccessor, AfterViewInit, OnDestroy, OnInit, OnChanges {
  /** suggestions list - array of strings, objects or Observable */
  @Input() suggestions: TypeaheadSuggestions = [];
  /**
   * template for items in drop down
   * properties exposed are item and index
   **/
  @Input() itemTemplate: TemplateRef<any>;
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
  set settings(value: Partial<TypeaheadSettings>) {
    Object.assign(this._settings, value);
  }

  get settings(): Partial<TypeaheadSettings> {
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
  allMatches: string[] | Object[]; // undefined as it's important to know when the data arrives

  // values
  values: any[] = [];

  private allMatchesSubscription: Subscription;
  private matchesSubscription: Subscription;
  private callbackQueue: Array<() => void> = [];

  /**
   * Default values for TypeaheadSettings
   * @type TypeaheadSettings
   * @private
   */
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
    if (this.isDisabled) {
      return;
    }

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
      (<Observable<any>> this.suggestions)
        .publishReplay(1)
        .refCount()
        .mergeAll() :
      Observable
        .of(...this.suggestions)
    );
    this.toggleDropdown(false);
    this._inputChangeEvent.emit('');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.suggestions && !changes.suggestions.firstChange) {
      this.allMatchesSubscription.unsubscribe();
      this.matchesSubscription.unsubscribe();
      this.ngOnInit();
    }
  }

  suggestionsInit(suggestion$: Observable<any>) {
    this.matchesSubscription = this._inputChangeEvent
      .debounceTime(this.settings.typeDelay)
      .mergeMap((value: string) => {
        const normalizedValue = sanitizeString(value);
        const filteredSuggestions$ = suggestion$.filter(this.filterSuggestion(normalizedValue));

        return this.settings.suggestionsLimit ?
          filteredSuggestions$.take(this.settings.suggestionsLimit).toArray() :
          filteredSuggestions$.toArray();
      })
      .subscribe((matches: string[] | Object[]) => {
        this.matches = matches;
      });
    this.allMatchesSubscription = suggestion$.toArray().subscribe((suggestions: string[] | Object[]) => {
      this.allMatches = suggestions;
      while(this.callbackQueue.length) {
        // take first one and process it
        this.callbackQueue.shift().apply(this);
        this._inputChangeEvent.emit('');
      }
    });
  }

  /**
   * Init method
   */
  ngAfterViewInit() {
    // set value to input
    this._input = this.elementRef.nativeElement.querySelector('input');
    if (!this.multi && this._value) {
      const callback = () => {
        this._input.value = this.complex ?
          this.extractNameById(this._value) :
          this._value;
      };
      if (this.allMatches || !this.complex) {
        callback.apply(this);
      } else {
        this.callbackQueue.push(callback);
      }
    }
  }

  /**
   * Cleanup timeout
   */
  ngOnDestroy(): void {
    this.allMatchesSubscription.unsubscribe();
    this.matchesSubscription.unsubscribe();
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
        } else if (this.complex && !this.multi && event.type === KEY_DOWN) {
          this.value = null;
        }
      }
    } else if (event.type === KEY_UP) {
      this.setValue(target.value);
      if ((event as KeyboardEvent).key === ENTER && target.value !== '') { // enter and value
        this.toggleDropdown(false);
      }
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

  /**
   * Set value to list of values or as a single value
   * @param value
   * @param {boolean} collapseMenu
   */
  setValue(value: any, collapseMenu?: boolean) {
    if ((!this.custom || this.complex) && !this.hasMatch(value)) {
      return;
    }
    if (this.multi) {
      if (!this.values.includes(value)) { // TODO: another issue
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

  /**
   * Remove value from list of values or clear out the value
   * @param value
   */
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
        const callback = function() {
          this.values = value ? value.map(this.parseObjectById.bind(this)) : [];
          // make sure not found value doesn't break the UI
          this.values = this.values.filter((val: any) => !!val);
        };
        if (this.allMatches || !value) {
          callback.apply(this);
        } else {
          this.callbackQueue.push(callback);
        }
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

  /**
   * Set disabled state of the component
   * @param {boolean} value
   */
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

  /**
   * @param {string} filter
   * @returns {(value: any) => boolean}
   */
  private filterSuggestion(filter: string) {
    return (value: any): boolean => {
      if (this.values.includes(value)) {
        return false;
      }
      if (typeof value === 'string') {
        return sanitizeString(value).includes(filter);
      } else {
        return sanitizeString(value[this.nameField]).includes(filter) &&
          !this.values.some((element: any) => element[this.idField] === value[this.idField]);
      }
    };
  }

  /**
   * Check if value has match
   * @param {string | Object} value
   * @returns {boolean}
   */
  private hasMatch(value: string | Object): boolean {
    const sanitizedValue = typeof value === 'string' ? sanitizeString(value) : null;

    for (const key in this.matches) {
      if (typeof this.matches[key] === 'string') {
        const sanitizedMatch = sanitizeString(<string> this.matches[key]);
        if (sanitizedMatch === sanitizedValue) {
          return true;
        }
      } else {
        if (typeof value === 'string') {
          const sanitizedMatch = sanitizeString((<any> this.matches[key])[this.nameField]);
          if (sanitizedMatch === sanitizedValue) {
            return true;
          }
        } else {
          if ((<any> this.matches[key])[this.idField] === (<any> value)[this.idField]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Get name by parsing id into object
   * @param id
   * @returns {string}
   */
  private extractNameById(id: any): string {
    const match: any = this.parseObjectById(id);
    if (match) {
      return match[this.nameField];
    } else {
      return '';
    }
  }

  /**
   * Get complex object from id
   * @param id
   * @returns {any}
   */
  private parseObjectById(id: any) {
    for (const key in this.allMatches) {
      if ((<any> this.allMatches[key])[this.idField] === id) {
        return this.allMatches[key];
      }
    }
    return null;
  }

  /**
   * Extract id field from the complex object by name or return value if it's string
   * @param {string | Object} value
   * @returns {any}
   */
  private extractIdentifier(value: string | Object) {
    if (this.complex) {
      if (typeof value === 'string') {
        const sanitizedValue = sanitizeString(value);
        const match: any = (<Object[]> this.allMatches).find((item: any) => sanitizeString(item[this.nameField]) === sanitizedValue);
        if (match) {
          return match[this.idField];
        }
        throw Error('Critical error: Match ID could not be extracted.');
      }
      return (<any> value)[this.idField];
    }
    return value;
  }

  /**
   * Extract name from complex object or return value if it's string
   * @param {string | Object} value
   * @returns {any}
   */
  private extractName(value: string | Object) {
    if (this.complex && typeof value !== 'string') {
      return (<any> value)[this.nameField];
    }
    return value;
  }
}
