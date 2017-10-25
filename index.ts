import { TypeaheadComponent } from './src/typeahead.component';
import { NgModule, ModuleWithProviders } from '@angular/core';
// import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
//  imports: [ReactiveFormsModule, FormsModule],
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
