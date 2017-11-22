export * from './src/typeahead.component';
export * from './src/typeahead.interface';

import { TypeaheadComponent } from './src/typeahead.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [CommonModule],
  declarations: [TypeaheadComponent],
  exports: [TypeaheadComponent]
})
export class TypeaheadModule {
}
