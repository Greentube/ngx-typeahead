import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DataService, ISWPlanet } from './data.service';
import { ICountry } from './countries';
import { Observable } from 'rxjs/Observable';
import { TypeaheadSettings } from 'ngx-type-ahead';
import 'rxjs/add/operator/delay';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  myForm: FormGroup;

  hobbies: string[];
  hobbies$: Observable<string[]>;
  countries: ICountry[];
  countries$: Observable<ICountry[]>;
  planets$: Observable<ISWPlanet[]>;

  customSettings: Partial<TypeaheadSettings> = {
    suggestionsLimit: 0
  };

  constructor(private formBuilder: FormBuilder, private dataService: DataService) {
    // ...
  }

  ngOnInit() {
    this.fetchData();
    this.initializeForm();
  }

  private fetchData() {
    this.hobbies$ = this.dataService.getHobbies();
    this.hobbies$.subscribe((hobbies: string[]) => {
      this.hobbies = hobbies;
    });
    this.countries$ = this.dataService.getCountries().delay(1000);
    this.dataService.getCountries().subscribe((countries: ICountry[]) => {
      this.countries = countries;
    });
    this.planets$ = this.dataService.getSWPlanets();
  }

  private initializeForm() {
    this.myForm = this.formBuilder.group({
      hobbySingleCustom: '',
      hobbySingleFixed: '',
      hobbyMultiCustom: [],
      hobbyMultiFixed: [],
      countrySingle: null,
      countryMulti: [],
      planet: [],
      hobbySingleCustomSet: { value: 'Abcd', disabled: true },
      hobbySingleFixedSet: { value: this.hobbies[0], disabled: true },
      hobbyMultiCustomSet: { value: ['Abcd'], disabled: true },
      hobbyMultiFixedSet: { value: [this.hobbies[0]], disabled: true },
      countrySingleSet: { value: this.countries[0].code, disabled: true },
      countryMultiSet: { value: [this.countries[0].code], disabled: true },
      planetSet: { value: ['https://swapi.co/api/planets/3/'], disabled: true }
    });
  }
}
