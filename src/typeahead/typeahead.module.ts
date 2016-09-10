import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {NgbHighlight} from './highlight';
import {NgbTypeaheadWindow} from './typeahead-window';
import {NgbTypeahead} from './typeahead';
import {NgbTypeaheadConfig} from './typeahead-config';

export {NgbTypeaheadConfig} from './typeahead-config';

@NgModule({
  declarations: [NgbTypeahead, NgbHighlight, NgbTypeaheadWindow],
  exports: [NgbTypeahead],
  imports: [CommonModule],
  entryComponents: [NgbTypeaheadWindow],
  providers: [NgbTypeaheadConfig]
})
export class NgbTypeaheadModule {
}
