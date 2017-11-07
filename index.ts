import { TypeaheadComponent } from './src/typeahead.component';
import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [CommonModule],
  declarations: [TypeaheadComponent],
  exports: [TypeaheadComponent]
})
export class ModalDialogModule {

  static forRoot(): ModuleWithProviders {
    return {
      ngModule: ModalDialogModule
    };
  }
}
