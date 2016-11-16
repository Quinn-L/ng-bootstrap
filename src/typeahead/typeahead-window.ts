import {Component, Input, Output, ElementRef, EventEmitter, TemplateRef, OnInit} from '@angular/core';

import {toString} from '../util/util';

/**
 * Context for the typeahead result template in case you want to override the default one
 */
export interface ResultTemplateContext {
  /**
   * Your typeahead result data model
   */
  result: any;

  /**
   * Search term from the input used to get current result
   */
  term: string;
}

@Component({
  selector: 'ngb-typeahead-window',
  exportAs: 'ngbTypeaheadWindow',
  host: {'class': 'dropdown-menu', 'style': 'display: block'},
  template: `
    <template #rt let-result="result" let-term="term" let-formatter="formatter">
      <ngb-highlight [result]="formatter(result)" [term]="term"></ngb-highlight>
    </template>
    <template ngFor [ngForOf]="results" let-result let-idx="index">
      <button type="button" class="dropdown-item" [class.active]="idx === activeIdx" 
        (mouseenter)="markActive(idx)" 
        (click)="select(result)">
          <template [ngTemplateOutlet]="resultTemplate || rt" 
          [ngOutletContext]="{result: result, term: term, formatter: formatter}"></template>
      </button>
    </template>
  `
})
export class NgbTypeaheadWindow implements OnInit {
  activeIdx = 0;

  /**
   * Flag indicating if the first row should be active initially
   */
  @Input() focusFirst = true;

  /**
   * Typeahead match results to be displayed
   */
  @Input() results;

  /**
   * Search term used to get current results
   */
  @Input() term: string;

  /**
   * A function used to format a given result before display. This function should return a formatted string without any
   * HTML markup
   */
  @Input() formatter = toString;

  /**
   * A template to override a matching result default display
   */
  @Input() resultTemplate: TemplateRef<ResultTemplateContext>;

  /**
   * Event raised when user selects a particular result row
   */
  @Output('select') selectEvent = new EventEmitter();

  constructor(private _elementRef: ElementRef){}

  getActive() { return this.results[this.activeIdx]; }

  markActive(activeIdx: number) { this.activeIdx = activeIdx; }

  next() {
    let prevIndex = this.activeIdx;
    if (this.activeIdx === this.results.length - 1) {
      this.activeIdx = this.focusFirst ? (this.activeIdx + 1) % this.results.length : -1;
    } else {
      this.activeIdx++;
    }
    this.updateView(prevIndex > this.activeIdx);
  }

  prev() {
    let prevIndex = this.activeIdx;
    if (this.activeIdx < 0) {
      this.activeIdx = this.results.length - 1;
    } else if (this.activeIdx === 0) {
      this.activeIdx = this.focusFirst ? this.results.length - 1 : -1;
    } else {
      this.activeIdx--;
    }
    this.updateView(prevIndex > this.activeIdx);
  }

  select(item) { this.selectEvent.emit(item); }

  ngOnInit() { this.activeIdx = this.focusFirst ? 0 : -1; }
  
  private updateView(navUpwards: boolean) {
    let buttons = (this._elementRef.nativeElement as HTMLElement).querySelectorAll('button');
    let directChildren: HTMLElement[] = [];
    for (let i = 0; i < buttons.length; i++) {
      let btn = buttons[i];
      if (btn.parentElement === this._elementRef.nativeElement){
        directChildren.push(btn as HTMLElement);
      }
    }
    
    if (this.activeIdx < 0 || this.activeIdx >= directChildren.length) {
      return;
    }
    let elem = directChildren[this.activeIdx];
    let result = isFullyVisibleVertically(elem, this._elementRef.nativeElement);
    if (!result.isVisible) {
      if (navUpwards) {
        elem.parentElement.scrollTop = elem.offsetTop;
      } else {
        let scrollOffset = elem.offsetTop + elem.offsetHeight
                            - elem.parentElement.offsetHeight;
        elem.parentElement.scrollTop = scrollOffset;
      }
    }
  }
}

function isFullyVisibleVertically(element: HTMLElement, rootElement: HTMLElement)
  : { isVisible: boolean, topClipped?: boolean, bottomClipped?: boolean } {
  let rect = element.getBoundingClientRect();
  let top = rect.top;
  let bottom = rect.bottom;
  let el = element.parentNode;

  do {
    rect = (el as HTMLElement).getBoundingClientRect();
    // element is below the bottom or clipping
    if (top >= rect.bottom || bottom > rect.bottom) {
      return { isVisible: false, topClipped: true };
    }
    // element is above the top or clipping
    if (top < rect.top || bottom <= rect.top) {
      return { isVisible: false, bottomClipped: true };
    }

    el = el.parentNode;
    } while (el !== document.body && el !== rootElement);
    // Check its within the document viewport
    if (bottom > document.documentElement.clientHeight) {
      return { isVisible: false, bottomClipped: true };
    } else {
      return { isVisible: true };
  }
}
