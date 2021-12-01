import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Router } from "@angular/router";

import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';

import { LoginService } from '../services/login.service';
import { ClientsService, ClientElement } from '../services/clients.service';
import { AppsService, AppElement } from '../services/apps.service';
import { WlanElement, WlansService } from '../services/wlans.service';

import { Label } from 'ng2-charts';
import { ChartDataSets } from 'chart.js';

import { ErrorDialog } from '../common/common-error';

import * as _moment from 'moment';
const moment = _moment;


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})


export class DashboardComponent implements OnInit {

  headers = {};
  cookies = {};
  host = '';
  self = {};
  orgs = [];
  sites = [];
  maps = [];
  org_id: string = "";
  site_id: string = "__any__";
  me: string = "";

  bandwidth = {
    keys: Array(),
    values: Array()
  }
  apps: AppElement[] = [];
  clients: ClientElement[] = [];
  total_rx: number = 0;
  total_tx: number = 0;

  wlans: WlanElement[] = [];

  // DATE SELECTORS
  @ViewChild('picker') picker: any;
  public min_start_date: moment.Moment = moment().subtract(7, 'day');
  public max_start_date: moment.Moment;
  startDateControl = new FormControl(moment().second(0).subtract(1, 'day'));
  public min_end_date: moment.Moment;
  public max_end_date: moment.Moment = moment();
  endDateControl = new FormControl(moment().second(0));


  // LOADINBG INDICATORS
  appsLoading = false;
  statsLoading = false;
  wlansLoading = false;
  wlansLoaded = false;

  table_to_display: string = "clients";

  /////////////////////////
  // Line Chart
  public lineChartLabels: Label[] = [];
  public lineChartData: ChartDataSets[] = [];
  public lineChartLegend = false;
  public lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    title: {
      display: true,
      text: 'Site Bandwidth'
    }, scales: {
      yAxes: [{ display: false }],
      xAxes: [{
        type: 'time',
        distribution: 'linear',
        time: {
          parser: 'YYYY-MM-DDTHH:mm:ssZ'
        }
      }]
    }, ticks: {
      beginAtZero: true
    }
  };


  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(
    private _http: HttpClient,
    private _loginService: LoginService,
    public _dialog: MatDialog,
    private _snackBar: MatSnackBar,
    private _clientsService: ClientsService,
    private _appsService: AppsService,
    private _wlansService: WlansService,
    private _router: Router
  ) { }

  //////////////////////////////////////////////////////////////////////////////
  /////           INIT
  //////////////////////////////////////////////////////////////////////////////

  ngOnInit() {
    this.startDateControl.setValue(this.setMinutes(this.startDateControl.value));
    this.startDateControl.valueChanges.subscribe(value => {
      this.min_end_date = moment(value);
    })
    this.endDateControl.setValue(this.setMinutes(this.endDateControl.value));
    this.endDateControl.valueChanges.subscribe(value => {
      this.max_start_date = moment(value);
    })

    this._loginService.headers.subscribe(headers => this.headers = headers)
    this._loginService.cookies.subscribe(cookies => this.cookies = cookies)
    this._loginService.host.subscribe(host => this.host = host)
    this._loginService.self.subscribe(self => this.self = self || {})
    this._loginService.org_id.subscribe(org_id => this.org_id = org_id)
    this._loginService.site_id.subscribe(site_id => this.site_id = site_id)

    if (!this.site_id) {
      this._router.navigate(["/select"]);
    } else {
      this.getSiteStats();
      this.getSiteClients();
      this.getSiteWlans();
    }
  }


  //////////////////////////////////////////////////////////////////////////////
  /////           TIME MANAGEMENT
  //////////////////////////////////////////////////////////////////////////////
  setMinutes(date: moment.Moment): moment.Moment {
    const minutes = date.minute();
    if (minutes < 10) date.minute(0);
    else if (minutes < 20) date.minute(10);
    else if (minutes < 30) date.minute(20);
    else if (minutes < 40) date.minute(30);
    else if (minutes < 50) date.minute(40);
    else date.minute(50);
    return date;
  }
  getStart(): number {
    return this.startDateControl.value.unix();
  }
  getEnd(): number {
    return this.endDateControl.value.unix();
  }

  refresh(): void {
    this.getSiteStats();
    this.getSiteClients();
  }
  //////////////////////////////////////////////////////////////////////////////
  /////           LOAD SITE STATS
  //////////////////////////////////////////////////////////////////////////////

  processTxRx(bytes_array: number[]): number {
    let bytes = 0;
    for (let i in bytes_array) {
      bytes = bytes + bytes_array[i];
    }
    return bytes;
  }

  parseBandwidth(data): void {
    this.lineChartLabels = [];
    for (let j in data["rt"]) {
      this.lineChartLabels.push(data["rt"][j]);
    }
    //this.lineChartLabels = data["rt"];
    this.lineChartData = [
      {
        data: data["rx_bytes"],
        label: 'Rx',
        backgroundColor: 'rgba(0,149,163,0.2)',
        borderColor: 'rgba(0,149,163,1)',
        pointBackgroundColor: 'rgba(0,149,163,1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(0,149,163,0.8)',
        fill: 'origin',
      },
      {
        data: data["tx_bytes"],
        label: 'Tx',
        backgroundColor: 'rgba(132,176,53,0.2)',
        borderColor: 'rgba(132,176,53,1)',
        pointBackgroundColor: 'rgba(132,176,53,1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(132,176,53,0.8)',
        fill: 'origin',
      }
    ];
    this.total_tx = this.processTxRx(data["tx_bytes"])
    this.total_rx = this.processTxRx(data["rx_bytes"])
  }


  getSiteStats(): void {
    var body = null
    body = { host: this.host, cookies: this.cookies, headers: this.headers, site_id: this.site_id, start: this.getStart(), end: this.getEnd() }
    if (body) {
      this.appsLoading = true;
      this._appsService.displaySet(false);
      this._http.post<any[]>('/api/sites/stats/', body).subscribe({
        next: data => {
          this.parseBandwidth(data);
          this._appsService.appsSet(data["top-app-by-bytes"]);
          this.apps = data["top-app-by-bytes"];
          this._appsService.displaySet(true);
          this.appsLoading = false;
        },
        error: error => {
          this.appsLoading = false;
          var message: string = "There was an error... "
          if ("error" in error) { message += error["error"]["message"] }
          this.openError(message)
        }
      })
    }
  }


  //////////////////////////////////////////////////////////////////////////////
  /////           LOAD CLIENTS STATS
  //////////////////////////////////////////////////////////////////////////////

  parseSiteClients(data): void {
    var tmp: ClientElement[] = [];
    this.clients = data["clients"]
    this.clients.forEach(client => {
      if (client.mac) {
        client.total_bytes = client.rx_bytes + client.tx_bytes
        tmp.push(client)
      } else {
        console.log(client)
      }
    })
    this._clientsService.clientsSet(tmp)

  }

  getSiteClients() {
    var body = null
    body = { host: this.host, cookies: this.cookies, headers: this.headers, site_id: this.site_id, start: this.getStart(), end: this.getEnd() }
    if (body) {
      this.statsLoading = true;
      this._clientsService.displaySet(false);
      this._http.post<any[]>('/api/sites/clients/', body).subscribe({
        next: data => {
          this.parseSiteClients(data);
          this._clientsService.displaySet(true);
          this.statsLoading = false;
        },
        error: error => {
          this.statsLoading = false;
          var message: string = "There was an error... "
          if ("error" in error) { message += error["error"]["message"] }
          this.openError(message)
        }
      })
    }
  }

  getSiteWlans(): void {
    var body = null
    this.wlansLoaded = false;
    body = { host: this.host, cookies: this.cookies, headers: this.headers, site_id: this.site_id }
    if (body) {
      this.wlansLoading = true;
      this._http.post<any[]>('/api/sites/wlans/', body).subscribe({
        next: data => {
          this._wlansService.wlansSet(data["wlans"]);
          this.wlansLoaded = true;
          this.wlansLoading = false;
        },
        error: error => {
          this.wlansLoading = false;
          var message: string = "There was an error... "
          if ("error" in error) { message += error["error"]["message"] }
          this.openError(message)
        }
      })
    }
  }



  //////////////////////////////////////////////////////////////////////////////
  /////           COMMON
  //////////////////////////////////////////////////////////////////////////////


  sortList(data, attribute) {
    return data.sort(function (a, b) {
      var nameA = a[attribute].toUpperCase(); // ignore upper and lowercase
      var nameB = b[attribute].toUpperCase(); // ignore upper and lowercase
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
      return 0;
    })
  }

  back(): void {
    this._router.navigateByUrl("/select")
  }

  //////////////////////////////////////////////////////////////////////////////
  /////           DIALOG BOXES
  //////////////////////////////////////////////////////////////////////////////
  // ERROR
  openError(message: string): void {
    const dialogRef = this._dialog.open(ErrorDialog, {
      data: message
    });
  }

  // SNACK BAR
  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, {
      duration: 5000,
      horizontalPosition: "center",
      verticalPosition: "top",
    });
  }
}


