import {
  Component, forwardRef, Input, OnDestroy, ElementRef, Output,
  EventEmitter, AfterViewInit, Inject, OnInit
} from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'typeahead',
  template: `
  `,
  styleUrls: ['./typeahead.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TypeaheadComponent), multi: true }],
  host: {
    '[class.show]': '_expanded',
    '[class.multi]': 'multiValue',
    '[attr.disabled]': '_isDisabled || null'
  }
})
export class TypeaheadComponent implements ControlValueAccessor, AfterViewInit, OnDestroy, OnInit {
  /** suggestions list - array of strings, objects or Observable*/
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
  @Input() public multiValue: boolean = false;
  /** display suggestions */
  @Input() public showSuggestions: boolean = true;


  @Output() valueChange = new EventEmitter();

  // internal value
  _value: any;
  _inputModifiedEmitter: EventEmitter<any> = new EventEmitter();

  // ui state
  _expanded: boolean = false;
  _isDisabled: boolean = false;

  private _input: HTMLInputElement;
  private _accumulatedTimeout: number;

  /**
   * CTOR
   * @param elementRef
   */
  constructor(@Inject(ElementRef) private elementRef: ElementRef) {
    this._accumulatedTimeout = 0;
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
    this._inputModifiedEmitter.emit('');
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
    this._input = this.elementRef.nativeElement.querySelector('input');
    if (!this.multiValue && this._value) {
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
    // const target = (event.target as HTMLInputElement);
  }

  /**
   * Move through collection on arrow commands
   * @param event
   * @param tag
   */
  handleButton(event: KeyboardEvent, tag: string) {
    // const target = (event.target as HTMLButtonElement);
  }

  /**
   * Write new value
   * @param value
   */
  writeValue(value: any): void {
    this.onChange(value);
  }

  setDisabledState(isDisabled: boolean): void { this._isDisabled = isDisabled; }
  onChange = (_: any) => { /**/ };
  onTouched = () => { /**/ };
  registerOnChange(fn: (_: any) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
}
