import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DataService } from './data.service';
import { ICountry } from './countries';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  myForm: FormGroup;

  hobbies: string[];
  countries: ICountry[];

  constructor(private formBuilder: FormBuilder, private dataService: DataService) {
    // ...
  }

  ngOnInit() {
    this.fetchData();
    this.initializeForm();
  }

  private fetchData(){
    this.dataService.getHobbies().subscribe((hobbies: string[]) => {
      this.hobbies = hobbies;
    });
    this.dataService.getCountries().subscribe((countries: ICountry[]) => {
      this.countries = countries;
    });
  }

  private initializeForm(){
    this.myForm = this.formBuilder.group({
      hobbySingleCustom: '',
      hobbySingleFixed: '',
      hobbyMultiCustom: '',
      hobbyMultiFixed: '',
      countrySingle: '',
      countryMulti: '',
      hobbySingleCustomSet: { value: 'Abcd', disabled: true },
      hobbySingleFixedSet: { value: this.hobbies[0], disabled: true },
      hobbyMultiCustomSet: { value: ['Abcd'], disabled: true },
      hobbyMultiFixedSet: { value: [this.hobbies[0]], disabled: true },
      countrySingleSet: { value: this.countries[0].code, disabled: true },
      countryMultiSet: { value: [this.countries[0].code], disabled: true }
    });
  }
}