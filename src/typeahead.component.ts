import {
  Component, forwardRef, Input, OnDestroy, ElementRef, Output,
  EventEmitter, Renderer, HostListener, AfterViewInit, Inject, TemplateRef, OnInit
} from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/toArray';
import 'rxjs/add/observable/from';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const MINIMAL_WAIT = 100;
// const MAXIMAL_WAIT = 800;

@Component({
  selector: 'typeahead',
  // changeDetection: ChangeDetectionStrategy.OnPush, // fix this later
  template: `
    <span class="btn badge badge-primary" *ngFor="let tag of _arrayOfValues">
      {{tag}}
    <i *ngIf="!_isDisabled" (click)="removeTag($event, tag)" class="theme-icon-remove"></i>
    </span>
    <input *ngIf="!_isDisabled || !multiValue || !_arrayOfValues.length" type="text" autocomplete="off"
           (keyup)="handleInput($event)" (keydown)="handleInput($event)" (paste)="handleInput($event)"
           (click)="toggleExpanded($event, true)" [disabled]="_isDisabled || null"/>
    <i class="dropdown-toggle" *ngIf="showSuggestions && !_isDisabled" (click)="toggleExpanded($event)"></i>

    <div role="menu" class="dropdown-menu" *ngIf="showSuggestions && _matches">
        <button class="dropdown-item" type="button" *ngFor="let suggestion of _matches"
                (mouseup)="addTag($event, suggestion)" (keydown)="handleButton($event, suggestion)"
                (keyup)="handleButton($event, suggestion)">
            {{suggestion}}
        </button>
        <div *ngIf="_matches.length == 0" disabled="true" role="menuitem" class="dropdown-item">
            {{'NO_RESULTS' | translate}}
        </div>
    </div>
  `,
  styleUrls: ['./typeahead.component.scss'],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TypeaheadComponent), multi: true}],
  host: {
    '[class.show]': '_expanded',
    '[class.multi]': 'multiValue',
    '[attr.disabled]': '_isDisabled || null'
  }
})
export class TypeaheadComponent implements ControlValueAccessor, AfterViewInit, OnDestroy, OnInit {
  /** suggestions list - array of strings, objects or Observable*/
  @Input() suggestions: string[] | Object[] | Observable<string[]> | Observable<Object[]> = [];
  /** template for items in drop down*/
  @Input() public suggestionTemplate: TemplateRef<any>;
  /** maximal number of visible items */
  @Input() public suggestionLimit: number;
  /** field to use from objects as name */
  @Input() public nameField: string;
  /** field to use from objects as id */
  @Input() public idField: string;
  /** delay of input type debounce */
  @Input() public inputDelay: number = 0;

  /** allow custom values */
  @Input() public custom: boolean = true;
  /** allow multiple values */
  @Input() public multiValue: boolean = false;
  /** display suggestions */
  @Input() public showSuggestions: boolean = true;


  @Output() valueChange = new EventEmitter();

  // internal value
  _value: any;
  _arrayOfValues: any[] = [];

  _matches: string[];
  _inputModifiedEmitter: EventEmitter<any> = new EventEmitter();

  // ui state
  protected _expanded: boolean = false;

  private _safeToRemove = false;
  private _input: HTMLInputElement;
  private _timeOut: number;
  private _accumulatedTimeout: number;
  private _isDisabled: boolean = false;

  /**
   * CTOR
   * @param elementRef
   * @param renderer
   */
  constructor(@Inject(ElementRef) private elementRef: ElementRef, @Inject(Renderer) private renderer: Renderer) {
    this._accumulatedTimeout = 0;
  }

  ngOnInit() {
    if (this.suggestions instanceof Observable) {
      this.asyncActions();
    } else {
      this.syncActions();
    }
    this._inputModifiedEmitter.emit('');
  }

  syncActions() {
    const stripDiacritics = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    this._inputModifiedEmitter.debounceTime(this.inputDelay)
      .mergeMap((value: string) => {
        const normalizedQuery = stripDiacritics(value);

        if (this.suggestions) {
          // filtered by option and combined into array
          return Observable.from(this.suggestions).filter((option: any) =>
            option && stripDiacritics(option).indexOf(normalizedQuery) !== -1
          ).filter((option: any) => !this.multiValue || this._arrayOfValues.indexOf(option) === -1
          ).toArray();
        } else {
          return [];
        }
      }).subscribe(
      (matches: any[]) => {
        this._matches = matches;
      },
      (err: any) => {
        // console.error(err);
      }
    );
  }

  asyncActions() {
    this._inputModifiedEmitter.debounceTime(this.inputDelay)
      .mergeMap(() => this.suggestions)
      .subscribe(
        (matches: any[]) => {
          this._matches = matches;
        },
        (err: any) => {
          // console.error(err);
        }
      );
  }

  /**
   * Init method
   */
  ngAfterViewInit() {
    this._input = this.elementRef.nativeElement.querySelector('input');
    if ( ! this.multiValue && this._value) {
      this._input.value = this._value;
    }
  }

  /**
   * Cleanup timeout
   */
  ngOnDestroy(): void {
    this.cleanUpTimeout();
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
          this.renderer.invokeElementMethod(this._input, 'focus', []);
        }
        return;
      }
    }

    this._expanded = false;

    if (!this.custom && this._matches.indexOf(this._input.value) === -1) {
      this._input.value = this.value = null;
      this._inputModifiedEmitter.emit('');
    } else if (this.multiValue) {
      this._input.value = null;
      this._inputModifiedEmitter.emit('');
    }
  }

  /**
   * Remove tag from input
   * @param event
   * @param tag
   */
  removeTag(event: Event, tag: string) {
    event.stopImmediatePropagation();
    event.stopPropagation();
    event.preventDefault();

    let index = this._value && this._value.indexOf(tag);
    if (index !== -1) {
      if (index === this._value.length - 1) {
        this.value = this._arrayOfValues = this._value.slice(0, this._value.length - 1);
      } else {
        this.value = this._arrayOfValues = this._value.slice(0, index).concat(this._value.slice(index + 1));
      }
      this.renderer.invokeElementMethod(this._input, 'focus', []);
      this._inputModifiedEmitter.emit('');
    }
  }

  /**
   * Add new tag (on enter and data list selection)
   * @param event
   * @param tag
   */
  addTag(event: Event, tag: string) {
    event.stopImmediatePropagation();
    event.stopPropagation();

    if (!this.custom && this._matches.indexOf(tag) === -1) {
      return;
    }
    if (this.multiValue) {
      let notExists = !this._value || !this._value.length || this._value.indexOf(tag) === -1;
      if (notExists && tag.length) {
        this.value = this._arrayOfValues = (this._value || []).concat([tag]);
        this._input.value = '';
        this._inputModifiedEmitter.emit('');
      }
    } else {
      this.value = tag;
      this._input.value = tag;
      this._inputModifiedEmitter.emit(tag);
    }
    if (!this.custom) {
      this._expanded = false;
    }
    this.renderer.invokeElementMethod(this._input, 'focus', []);
  }

  /**
   * Toggle dropdown
   */
  toggleExpanded(event: Event, value?: boolean) {
    event.stopPropagation();
    event.preventDefault();

    this._expanded = value !== void 0 ?
      value :
      !this._expanded;
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
    event.stopImmediatePropagation();
    event.stopPropagation(); // stop event bleeding

    let target = (event.target as HTMLInputElement);
    this._expanded = true;

    if (this.multiValue) {
      if (event.type === 'keydown' || event.type === 'keyup') {
        if ((event as KeyboardEvent).keyCode === 13 && target.value !== '') { // enter
          this.addTag(event, target.value);
        }
        if ((event as KeyboardEvent).keyCode === 8 && target.value === '') { // backspace
          if (event.type === 'keydown') {
            this._safeToRemove = true;
          } else if (this._safeToRemove && this._value) {
            this._safeToRemove = false;
            this.removeTag(event, this._value[this._value.length - 1]);
          }
        }
      }
    } else if (this.custom && event.type === 'keyup') {
      this.addTag(event, target.value);
    }
    if (event.type === 'keydown' || event.type === 'keyup') {
      if ((event as KeyboardEvent).keyCode === 40 && this._matches.length > 0) { // arrow down
        let button = this.elementRef.nativeElement.querySelector('button.dropdown-item:first-child');
        this.renderer.invokeElementMethod(button, 'focus', []);
      }
    }
    this._inputModifiedEmitter.emit(target.value);
  }

  /**
   * Move through collection on arrow commands
   * @param event
   * @param tag
   */
  handleButton(event: KeyboardEvent, tag: string) {
    event.stopImmediatePropagation();
    event.stopPropagation(); // stop event bleeding

    let target = (event.target as HTMLButtonElement);

    if (event.type === 'keydown') {
      if (event.keyCode === 13 && target.nextElementSibling) {  // enter
        this.addTag(event, tag);
      }
      if (event.keyCode === 40 && target.nextElementSibling) {  // arrow down
        this.renderer.invokeElementMethod(target.nextElementSibling, 'focus', []);
      }
      if (event.keyCode === 38 && target.previousElementSibling) { // arrow up
        this.renderer.invokeElementMethod(target.previousElementSibling, 'focus', []);
      }
    } else {
      this.scrollToTarget(target);
    }
  }

  /**
   * Scroll to focused element
   * @param target
   */
  scrollToTarget(target: any) {
    let parent = target.parentNode;
    parent.scrollTop = target.offsetTop;
  }

  /**
   * Write new value
   * @param value
   */
  writeValue(value: any): void {
    if (!value || !value.length) {
      value = void 0;
    }
    this._value = value;
    this._arrayOfValues = this.multiValue ? (value || []) : [];

    this.elementRef.nativeElement.value = value;
    this.triggerOnChange(this.elementRef.nativeElement); // trigger on change event
    this.onChange(value);
  }

  triggerOnChange(element: any) {
    if ('createEvent' in document) {
      let evt = document.createEvent('HTMLEvents');
      evt.initEvent('change', false, true);
      element.dispatchEvent(evt);
    } else {
      element.fireEvent('onchange');
    }
  }

  setDisabledState(isDisabled: boolean): void { this._isDisabled = isDisabled; }
  onChange = (_: any) => { /**/ };
  onTouched = () => { /**/ };
  registerOnChange(fn: (_: any) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  /**
   * Emit value change event
   * @param value
   * @private
   */
  // private _emitChangedEvent(value: string) {
  //  // only if wait is below threshold
  //  if (this._accumulatedTimeout < MAXIMAL_WAIT) {
  //    this.cleanUpTimeout();
  //  }
  //  // fire up new timeout
  //  this._timeOut = window.setTimeout(() => {
  //    let existingValues = this._arrayOfValues;
  //    this.valueChange.emit({ value: value, existing: existingValues });
  //    this._timeOut = null;
  //    this._accumulatedTimeout = 0;
  //  }, MINIMAL_WAIT);
  // }

  /**
   * Clear current timeout
   */
  private cleanUpTimeout() {
    if (this._timeOut) {
      this._accumulatedTimeout += MINIMAL_WAIT;
      clearTimeout(this._timeOut);
      this._timeOut = null;
    }
  }
}
