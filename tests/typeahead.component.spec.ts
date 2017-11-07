import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { TypeaheadComponent } from '../src/typeahead.component';
import { Observable } from 'rxjs';

describe('TypeaheadComponent', () => {
  let
    fixture: ComponentFixture<TypeaheadComponent>,
    component: TypeaheadComponent;

  beforeEach(() => {
    jasmine.clock().uninstall();
    jasmine.clock().install();

    const module = TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [TypeaheadComponent]
    });

    fixture = module.createComponent(TypeaheadComponent);
    component = fixture.componentInstance;
  });

  it('should initialize component', () => {
    expect(fixture).toBeDefined('fixture should exist');
    fixture.detectChanges();
    expect(component instanceof TypeaheadComponent).toBeTruthy('Should be instance of TypeaheadComponent');
  });

  it('should copy suggestions to allmatches', fakeAsync(() => {
    const suggestions = ['ABC', 'DEF', 'GHI'];
    component.suggestions = suggestions;
    fixture.detectChanges();
    tick();
    expect(component.allMatches).toEqual(suggestions);
  }));

  it('should copy observable suggestions to allmatches', fakeAsync(() => {
    const suggestions: string[] = ['ABC', 'DEF', 'GHI'];
    const suggestions$: Observable<string[]> = Observable.of(suggestions);
    component.suggestions = suggestions$;
    fixture.detectChanges();
    tick();
    expect(component.allMatches).toEqual(suggestions);
  }));

  it('should set simple value', fakeAsync(() => {
    const suggestions = ['ABC', 'DEF', 'GHI'];
    component.suggestions = suggestions;
    component.value = 'ABC';
    fixture.detectChanges();
    expect((<any> component)._input.value).toEqual('ABC');
  }));

  it('should set multiple values', fakeAsync(() => {
    const suggestions = ['ABC', 'DEF', 'GHI'];
    component.suggestions = suggestions;
    component.multi = true;
    component.value = ['ABC', 'DEF'];
    fixture.detectChanges();
    expect(component.values).toEqual(['ABC', 'DEF']);
    expect((<any> component)._input.value).toEqual('');
  }));

  it('should set complex value', fakeAsync(() => {
    const suggestions = [{ name: 'ABC', id: 'A' }, { name: 'DEF', id: 'D' }, { name: 'GHI', id: 'G' }];
    component.complex = true;
    component.suggestions = suggestions;
    component.value = 'A';
    fixture.detectChanges();
    expect((<any> component)._input.value).toEqual('ABC');
  }));

  it('should set multiple complex values', fakeAsync(() => {
    const suggestions = [{ name: 'ABC', id: 'A' }, { name: 'DEF', id: 'D' }, { name: 'GHI', id: 'G' }];
    component.suggestions = suggestions;
    component.complex = true;
    component.multi = true;
    fixture.detectChanges();
    tick();

    component.value = ['A', 'D'];
    fixture.detectChanges();
    expect(component.values).toEqual([{ name: 'ABC', id: 'A' }, { name: 'DEF', id: 'D' }]);
    expect((<any> component)._input.value).toEqual('');
  }));

  it('should show dropdown on input', fakeAsync(() => {
    const suggestions = ['ABC', 'DEF', 'GHI'];
    component.suggestions = suggestions;
    fixture.detectChanges();
    tick();

    const input = (<any> component)._input;
    expect(component.isExpanded).toBeFalsy();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    fixture.detectChanges();
    expect(component.isExpanded).toBeTruthy();
  }));

  it('should hide dropdown on escape', fakeAsync(() => {
    const suggestions = ['ABC', 'DEF', 'GHI'];
    component.suggestions = suggestions;
    fixture.detectChanges();
    tick();

    const input = (<any> component)._input;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    fixture.detectChanges();
    expect(component.isExpanded).toBeTruthy();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.isExpanded).toBeFalsy();
  }));
});
