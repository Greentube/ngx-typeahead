import {
  Component, forwardRef, Input, OnDestroy, ElementRef, Output,
  EventEmitter, AfterViewInit, Inject, OnInit
} from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const KEY_UP = 'keyup';
const KEY_DOWN = 'keydown';

@Component({
  selector: 'typeahead',
  template: `
    <input *ngIf="!_isDisabled" [disabled]="_isDisabled || null"
           type="text" autocomplete="off"
           (keyup)="handleInput($event)"
           (keydown)="handleInput($event)"
           (paste)="handleInput($event)"/>
  `,
  styleUrls: ['./typeahead.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TypeaheadComponent), multi: true }],
  host: {
    '[attr.disabled]': '_isDisabled || null'
  }
})
export class TypeaheadComponent implements ControlValueAccessor, AfterViewInit, OnDestroy, OnInit {
  /** suggestions list - array of strings, objects or Observable */
  @Input() suggestions: string[] | Object[] | Observable<string[]> | Observable<Object[]> = [];
  // /** template for items in drop down*/
  // @Input() public suggestionTemplate: TemplateRef<any>;
  /** maximal number of visible items */
  @Input() public suggestionLimit: number;
  /** field to use from objects as name */
  @Input() public nameField: string;
  /** field to use from objects as id */
  @Input() public idField: string;
  /** delay of input type debounce */
  @Input() public inputDelay: number = 50;

  /** allow custom values */
  @Input() public custom: boolean = true;
  /** allow multiple values */
  @Input() public multi: boolean = false;
  /** display suggestions */
  @Input() public showSuggestions: boolean = true;

  /** Output value change */
  @Output() valueChange = new EventEmitter();

  // ui state
  _isDisabled: boolean = false;

  private _input: HTMLInputElement;
  private _inputChangeEvent: EventEmitter<any> = new EventEmitter();
  private _value: any; // TODO: Check value

  /**
   * CTOR
   * @param elementRef
   */
  constructor(@Inject(ElementRef) private elementRef: ElementRef) {
  }

  /**
   * On component initialization
   */
  ngOnInit() {
    if (this.suggestions instanceof Observable) {
      this.asyncSuggestionsInit();
    } else {
      this.syncSuggestionsInit();
    }
    this._inputChangeEvent.emit('');
  }

  syncSuggestionsInit() {
    // const sanitizeString = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

    if (event.type === KEY_UP) {
      this.setValue(target.value);
    }
    this._inputChangeEvent.emit(target.value);
  }

  /**
   * Move through collection on arrow commands
   * @param event
   * @param tag
   */
  handleButton(event: KeyboardEvent, tag: string) {
    // const target = (event.target as HTMLButtonElement);
  }

  setValue(value: string) {
    this.value = value;
    this._input.value = value;
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

  setDisabledState(isDisabled: boolean): void { this._isDisabled = isDisabled; }
  onChange = (_: any) => { /**/ };
  onTouched = () => { /**/ };
  registerOnChange(fn: (_: any) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

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
}
