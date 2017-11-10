# ngx-typeahead
[![Build Status](https://travis-ci.org/Greentube/ngx-typeahead.svg?branch=master)](https://travis-ci.org/Greentube/ngx-typeahead)
[![Build Status](https://circleci.com/gh/Greentube/ngx-typeahead.svg?style=shield)](https://circleci.com/gh/Greentube/ngx-typeahead)

> Typeahead multi-select dropdown component for angular

# Table of contents:
- [Installation](#installation)
- [How it works](#how-it-works)
- [Usage](#usage)
- [API](#api)
- [License](#license)

## Installation

```
npm install --save ngx-type-ahead
```

## How it works
Type ahead uses (observable) array of items to suggest value to user based on current value of the input.

Items can be simple strings or they could be objects. Here is a brief list of functionality:
* Standard type ahead functionality 
* Custom inputs (only if suggestions are strings)
* Fixed scope of values - limited to suggestions
* Selecting multiple values
* Suggestions as an array or observable of array
* Suggestion as an object - user specifies which property is `view value` and which is `value indentifier`.

## Usage
In order to use `ngx-type-ahead` you need to import the module and simply place component in your template.

```ts
@NgModule({
  imports: [
    TypeaheadModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

```html
<type-ahead formControlName="myControl" [suggestions]="mySuggestions"></type-ahead>
```

## API
### DOM element properties
`Type-ahead` supports following properties:  
- `suggestions: TypeaheadSuggestions` - List or observable list of elements which represent set of possible suggestions. For more information on type check [TypeaheadSuggestions](#typeaheadsuggestions)  
  Default value is `[]`.  
- `custom: boolean` - Flag indicating whether custom values are allowed  
  Default value is `true`.  
- `multi: boolean` - Flag indicating whether control accepts multiple values/array of values.  
  Default value is `false`.  
- `complex: boolean` - Flag indicating whether suggestion represents an Object instead of simple string.    
  Default value is `false`.  
- `idField: string` - Only for `complex` suggestions. Object's indicator property name used as a value for form component. Can be just in combination with `multi`, but automatically cancels `custom`.    
  Default value is `id`.  
- `nameField: string` - Only for `complex` suggestions. Object's name property. This value will be shown in dropdown and in the input, but `idField` will be saved to form.  
  Default value is `name`. 
- `settings: TypeaheadSettings` - Additional typeahead settings, mostly style related that will most likely be shared among different `type-ahead` elements.  

### TypeaheadSuggestions
Type representing suggestions. Can be:
* string[]
* Object[]
* Observable<string[]>
* Observable<Object[]>

### TypeaheadSettings
```ts
export interface TypeaheadSettings {
  /** how much should be user's typing debounced. Default is `50` */
  typeDelay?: number;
  /** maximal number of visible items in dropdown. Default is `10` */
  suggestionsLimit?: number;
  /** text shown when there are no matches. Default is `No matches found` */
  noMatchesText?: string;

  /** css classes for parts of type-ahead */
  tagClass?: string; // Default is `btn badge badge-primary`
  tagRemoveIconClass?: string; // Default is `close`
  dropdownMenuClass?: string; // Default is `dropdown-menu`
  dropdownMenuExpandedClass?: string; // Default is `dropdown-menu show`
  dropdownMenuItemClass?: string; // Default is `dropdown-item`
  dropdownToggleClass?: string; // Default is `dropdown-toggle`
}
```

## License
Licensed under MIT
