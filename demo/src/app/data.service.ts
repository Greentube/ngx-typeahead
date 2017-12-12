import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/of';
import { Countries, ICountry } from './countries';
import { HttpClient } from '@angular/common/http';
import { Inject } from '@angular/core';

export interface ISWPlanet {
  climate: string;
  gravity: string;
  name: string;
  url: string;
  terrain: string;
  population: string;
  orbital_period: string;
}

export interface ISWResult<T> {
  count: number;
  next: string;
  previous: string;
  results: T[];
}

export class DataService {

  constructor(@Inject(HttpClient) private http: HttpClient) {
  }

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

  getSWPlanets(): Observable<ISWPlanet[]> {
    return this.http.get<ISWResult<ISWPlanet>>(`https://swapi.co/api/planets/`).map(result => result.results);
  }
}

function sanitizeString(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

