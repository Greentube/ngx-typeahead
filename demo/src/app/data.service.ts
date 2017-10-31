import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/of';
import { Countries, ICountry } from './countries';

export class DataService {

  /**
   * Filter hobbies
   * @param {string} filter
   * @returns {Observable<string[]>}
   */
  getHobbies(filter: string = ''): Observable<string[]> {
    const hobbies = [
      'Skiing',
      'Snowboarding',
      'Reading',
      'Coding',
      'Hiking',
      'Movies',
      'Photography'
    ];
    const sanitizedFilter = sanitizeString(filter);
    return Observable.of(hobbies.filter(hobby => sanitizeString(hobby).indexOf(sanitizedFilter) !== -1));
  }

  /**
   * Filter countries
   * @param {string} filter
   * @returns {Observable<ICountry[]>}
   */
  getCountries(filter: string = ''): Observable<ICountry[]> {
    const sanitizedFilter = sanitizeString(filter);
    return Observable.of(Countries.filter(country => sanitizeString(country.name).indexOf(sanitizedFilter) !== -1));
  }
}

function sanitizeString(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

