import {
  Directive,
  Input,
  ComponentRef,
  ElementRef,
  ViewContainerRef,
  Renderer,
  ComponentFactoryResolver,
  NgZone,
  TemplateRef,
  forwardRef,
  EventEmitter,
  Output,
  OnDestroy
} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

import {NgbDate} from './ngb-date';
import {NgbDatepicker, NgbDatepickerNavigateEvent} from './datepicker';
import {DayTemplateContext} from './datepicker-day-template-context';
import {NgbDateParserFormatter} from './ngb-date-parser-formatter';

import {positionElements} from '../util/positioning';
import {NgbDateStruct} from './ngb-date-struct';
import {NgbDatepickerService} from './datepicker-service';

const NGB_DATEPICKER_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => NgbInputDatepicker),
  multi: true
};

/**
 * A directive that makes it possible to have datepickers on input fields.
 * Manages integration with the input field itself (data entry) and ngModel (validation etc.).
 */
@Directive({
  selector: 'input[ngbDatepicker]',
  exportAs: 'ngbDatepicker',
  host: {'(change)': 'manualDateChange($event.target.value)', '(keyup.esc)': 'close()', '(blur)': 'onBlur()'},
  providers: [NGB_DATEPICKER_VALUE_ACCESSOR]
})
export class NgbInputDatepicker implements ControlValueAccessor,
    OnDestroy {
  private _cRef: ComponentRef<NgbDatepicker> = null;
  private _model: NgbDate;
  private _zoneSubscription: any;

  private _ignoreUpdatePosition = false;
  private _scrollListener: (ev: UIEvent) => void;

  /**
   * Reference for the custom template for the day display
   */
  @Input() dayTemplate: TemplateRef<DayTemplateContext>;

  /**
   * Number of months to display
   */
  @Input() displayMonths: number;

  /**
  * First day of the week. With default calendar we use ISO 8601: 1=Mon ... 7=Sun
   */
  @Input() firstDayOfWeek: number;

  /**
   * Callback to mark a given date as disabled.
   * 'Current' contains the month that will be displayed in the view
   */
  @Input() markDisabled: (date: NgbDateStruct, current: {year: number, month: number}) => boolean;

  /**
   * Min date for the navigation. If not provided will be 10 years before today or `startDate`
   */
  @Input() minDate: NgbDateStruct;

  /**
   * Max date for the navigation. If not provided will be 10 years from today or `startDate`
   */
  @Input() maxDate: NgbDateStruct;

  /**
   * Navigation type: `select` (default with select boxes for month and year), `arrows`
   * (without select boxes, only navigation arrows) or `none` (no navigation at all)
   */
  @Input() navigation: 'select' | 'arrows' | 'none';

  /**
   * The way to display days that don't belong to current month: `visible` (default),
   * `hidden` (not displayed) or `collapsed` (not displayed with empty space collapsed)
   */
  @Input() outsideDays: 'visible' | 'collapsed' | 'hidden';

  /**
   * Whether to display footer
   */
  @Input() showFooter: boolean;

  /**
   * Whether to display days of the week
   */
  @Input() showWeekdays: boolean;

  /**
   * Whether to display week numbers
   */
  @Input() showWeekNumbers: boolean;

  /**
   * Date to open calendar with.
   * With default calendar we use ISO 8601: 'month' is 1=Jan ... 12=Dec.
   * If nothing or invalid date provided, calendar will open with current month.
   * Use 'navigateTo(date)' as an alternative
   */
  @Input() startDate: {year: number, month: number};

  /**
   * An event fired when navigation happens and currently displayed month changes.
   * See NgbDatepickerNavigateEvent for the payload info.
   */
  @Output() navigate = new EventEmitter<NgbDatepickerNavigateEvent>();

  private _onChange = (_: any) => {};
  private _onTouched = () => {};


  constructor(
      private _parserFormatter: NgbDateParserFormatter, private _elRef: ElementRef, private _vcRef: ViewContainerRef,
      private _renderer: Renderer, private _cfr: ComponentFactoryResolver, ngZone: NgZone,
      private _service: NgbDatepickerService) {
    this._zoneSubscription = ngZone.onStable.subscribe(() => {
      if (this._cRef && !this._ignoreUpdatePosition) {
        positionElements(this._elRef.nativeElement, this._cRef.location.nativeElement, 'bottom-left', true);
      }
      this._ignoreUpdatePosition = false;
    });
  }

  ngOnDestroy() {
    this.close();
    this._zoneSubscription.unsubscribe();
  }

  registerOnChange(fn: (value: any) => any): void { this._onChange = fn; }

  registerOnTouched(fn: () => any): void { this._onTouched = fn; }

  writeValue(value) {
    this._model =
        value ? this._service.toValidDate({year: value.year, month: value.month, day: value.day}, null) : null;
    this._writeModelValue(this._model);
  }

  setDisabledState(isDisabled: boolean): void {
    this._renderer.setElementProperty(this._elRef.nativeElement, 'disabled', isDisabled);
    if (this.isOpen()) {
      this._cRef.instance.setDisabledState(isDisabled);
    }
  }

  manualDateChange(value: string) {
    this._model = this._service.toValidDate(this._parserFormatter.parse(value), null);
    this._onChange(this._model ? {year: this._model.year, month: this._model.month, day: this._model.day} : null);
    this._writeModelValue(this._model);
  }

  isOpen() { return !!this._cRef; }

  /**
   * Opens the datepicker with the selected date indicated by the ngModel value.
   */
  open() {
    if (!this.isOpen()) {
      const cf = this._cfr.resolveComponentFactory(NgbDatepicker);
      this._cRef = this._vcRef.createComponent(cf);

      this._applyPopupStyling(this._cRef.location.nativeElement);
      this._cRef.instance.writeValue(this._model);
      this._applyDatepickerInputs(this._cRef.instance);
      this._subscribeForDatepickerOutputs(this._cRef.instance);
      this._cRef.instance.ngOnInit();

      // date selection event handling
      this._cRef.instance.registerOnChange((selectedDate) => {
        this.writeValue(selectedDate);
        this._onChange(selectedDate);
        this.close();
      });

      document.body.appendChild(this._cRef.location.nativeElement);
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

  /**
   * Closes the datepicker popup.
   */
  close() {
    document.removeEventListener('scroll', this._scrollListener, true);
    if (this.isOpen()) {
      this._vcRef.remove(this._vcRef.indexOf(this._cRef.hostView));
      this._cRef = null;
    }
  }

  /**
   * Toggles the datepicker popup (opens when closed and closes when opened).
   */
  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Navigates current view to provided date.
   * With default calendar we use ISO 8601: 'month' is 1=Jan ... 12=Dec.
   * If nothing or invalid date provided calendar will open current month.
   * Use 'startDate' input as an alternative
   */
  navigateTo(date?: {year: number, month: number}) {
    if (this.isOpen()) {
      this._cRef.instance.navigateTo(date);
    }
  }

  onBlur() { this._onTouched(); }

  private _applyDatepickerInputs(datepickerInstance: NgbDatepicker): void {
    ['dayTemplate', 'displayMonths', 'firstDayOfWeek', 'markDisabled', 'minDate', 'maxDate', 'navigation',
     'outsideDays', 'showFooter', 'showNavigation', 'showWeekdays', 'showWeekNumbers']
        .forEach((optionName: string) => {
          if (this[optionName] !== undefined) {
            datepickerInstance[optionName] = this[optionName];
          }
        });
    datepickerInstance.startDate = this.startDate || this._model;
  }

  private _applyPopupStyling(nativeElement: any) {
    this._renderer.setElementClass(nativeElement, 'dropdown-menu', true);
    this._renderer.setElementStyle(nativeElement, 'display', 'block');
    this._renderer.setElementStyle(nativeElement, 'padding', '0.40rem');
  }

  private _subscribeForDatepickerOutputs(datepickerInstance: NgbDatepicker) {
    datepickerInstance.navigate.subscribe(date => this.navigate.emit(date));
  }

  private _writeModelValue(model: NgbDate) {
    this._renderer.setElementProperty(this._elRef.nativeElement, 'value', this._parserFormatter.format(model));
    if (this.isOpen()) {
      this._cRef.instance.writeValue(model);
      this._onTouched();
    }
  }
}
