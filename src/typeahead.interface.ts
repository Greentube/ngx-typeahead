import { Observable } from 'rxjs/Observable';

export type TypeaheadSuggestions = string[] | Object[] | Observable<string[]> | Observable<Object[]>;

export interface TypeaheadSettings {
  /** delay of input type debounce */
  typeDelay?: number;
  /** maximal number of visible items */
  suggestionsLimit?: number;
  /** text shown when there are no matches */
  noMatchesText?: string;

  tagClass?: string;
  tagRemoveIconClass?: string;
  dropdownMenuClass?: string;
  dropdownMenuExpandedClass?: string;
  dropdownMenuItemClass?: string;
  dropdownToggleClass?: string;
}
