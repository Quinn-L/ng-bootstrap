import {
  Directive,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ComponentRef,
  ComponentFactoryResolver,
  ViewContainerRef,
  Injector,
  Renderer,
  ElementRef,
  TemplateRef,
  forwardRef,
  AfterViewChecked,
  OnDestroy
} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {Observable, Subject, Subscription} from 'rxjs/Rx';
import 'rxjs/add/operator/let';
import {Positioning} from '../util/positioning';
import {NgbTypeaheadWindow, ResultTemplateContext} from './typeahead-window';
import {PopupService} from '../util/popup';
import {toString} from '../util/util';

enum Key {
  Tab = 9,
  Enter = 13,
  Escape = 27,
  ArrowUp = 38,
  ArrowDown = 40
}

const NGB_TYPEAHEAD_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => NgbTypeahead),
  multi: true
};

/**
 * NgbTypeahead directive provides a simple way of creating powerful typeaheads from any text input
 */
@Directive({
  selector: 'input[ngbTypeahead]',
  host: {
    '(blur)': 'onTouched()',
    '[class.open]': 'isPopupOpen()',
    '(document:click)': 'closePopup()',
    '(input)': 'onChange($event.target.value)',
    '(keydown)': 'handleKeyDown($event)',
    'autocomplete': 'off',
    'autocapitalize': 'off',
    'autocorrect': 'off'
  },
  providers: [NGB_TYPEAHEAD_VALUE_ACCESSOR]
})
export class NgbTypeahead implements OnInit,
    AfterViewChecked, ControlValueAccessor, OnDestroy {
  private _onChangeNoEmit: (_: any) => void;
  private _popupService: PopupService<NgbTypeaheadWindow>;
  private _positioning = new Positioning();
  private _subscription: Subscription;
  private _valueChanges = new Subject<string>();
  private _windowRef: ComponentRef<NgbTypeaheadWindow>;

  private _ignoreUpdatePosition = false;
  private _scrollListener: (ev: UIEvent) => void;

  /**
   * A function to convert a given value into string to display in the input field
   */
  @Input() inputFormatter: (value: any) => string;

  /**
   * A function to transform the provided observable text into the array of results
   */
  @Input() ngbTypeahead: (text: Observable<string>) => Observable<any[]>;

  /**
   * A function to format a given result before display. This function should return a formatted string without any
   * HTML markup
   */
  @Input() resultFormatter: (value: any) => string;

  /**
   * A template to override a matching result default display
   */
  @Input() resultTemplate: TemplateRef<ResultTemplateContext>;

  /**
   * An event emitted when a match is selected. Event payload is equal to the selected item
   */
  @Output() selectItem = new EventEmitter();

  onChange = (value) => {
    this._onChangeNoEmit(value);
    this._valueChanges.next(value);
  };

  onTouched = () => {};

  constructor(
      private _elementRef: ElementRef, private _viewContainerRef: ViewContainerRef, private _renderer: Renderer,
      private _injector: Injector, componentFactoryResolver: ComponentFactoryResolver) {
    this._popupService = new PopupService<NgbTypeaheadWindow>(
        NgbTypeaheadWindow, _injector, _viewContainerRef, _renderer, componentFactoryResolver);
    this._onChangeNoEmit = (_: any) => {};
  }

  ngAfterViewChecked() {
    if (this._windowRef && !this._ignoreUpdatePosition) {
      const targetPosition = this._positioning.positionElements(
          this._elementRef.nativeElement, this._windowRef.location.nativeElement, 'bottom-left', true);

      const targetStyle = this._windowRef.location.nativeElement.style;
      targetStyle.top = `${targetPosition.top}px`;
      targetStyle.left = `${targetPosition.left}px`;
    }
    this._ignoreUpdatePosition = false;
  }

  ngOnDestroy() {
    this.closePopup();
    this._subscription.unsubscribe();
  }

  ngOnInit() {
    this._subscription = this._valueChanges.let (this.ngbTypeahead).subscribe((results) => {
      if (!results || results.length === 0) {
        this.closePopup();
      } else {
        this._openPopup();
        this._windowRef.instance.results = results;
        this._windowRef.instance.term = this._elementRef.nativeElement.value;
        if (this.resultFormatter) {
          this._windowRef.instance.formatter = this.resultFormatter;
        }
        if (this.resultTemplate) {
          this._windowRef.instance.resultTemplate = this.resultTemplate;
        }
      }
    });
  }

  registerOnChange(fn: (value: any) => any): void { this._onChangeNoEmit = fn; }

  registerOnTouched(fn: () => any): void { this.onTouched = fn; }

  writeValue(value) {
    const formattedValue = value && this.inputFormatter ? this.inputFormatter(value) : toString(value);
    this._renderer.setElementProperty(this._elementRef.nativeElement, 'value', formattedValue);
  }

  /**
   * @internal
   */
  isPopupOpen() { return this._windowRef != null; }

  /**
   * @internal
   */
  closePopup() {
    document.removeEventListener('scroll', this._scrollListener, true);
    this._popupService.close();
    this._windowRef = null;
  }

  /**
   * @internal
   */
  handleKeyDown(event: KeyboardEvent) {
    if (!this._windowRef) {
      return;
    }

    if (Key[toString(event.which)]) {
      event.preventDefault();

      switch (event.which) {
        case Key.ArrowDown:
          this._windowRef.instance.next();
          break;
        case Key.ArrowUp:
          this._windowRef.instance.prev();
          break;
        case Key.Enter:
        case Key.Tab:
          const result = this._windowRef.instance.getActive();
          this._selectResult(result);
          break;
        case Key.Escape:
          this.closePopup();
          break;
      }
    }
  }

  private _openPopup() {
    if (!this._windowRef) {
      this._windowRef = this._popupService.open(null, true);
      this._windowRef.instance.selectEvent.subscribe((result: any) => this._selectResult(result));
      this._scrollListener = (ev: UIEvent) => {
        // document level event  also triggers ngAfterViewChecked
        if (ev.target === document) {
          // Don't need to update if the scroll happened on the document, since
          // the popup is relative to the document
          this._ignoreUpdatePosition = true;
        }
      };
      document.addEventListener('scroll', this._scrollListener, true);
    }
  }

  private _selectResult(result: any) {
    this.writeValue(result);
    this._onChangeNoEmit(result);
    this.selectItem.emit(result);
    this.closePopup();
  }
}

export const NGB_TYPEAHEAD_DIRECTIVES = [NgbTypeahead];
