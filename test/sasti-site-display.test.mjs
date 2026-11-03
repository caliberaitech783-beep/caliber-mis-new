import assert from 'node:assert/strict';
import test from 'node:test';
import {buildDepartmentReports} from '../shared/reports/department-reports.mjs';
import {buildDirectorReportTables,DIRECTOR_REPORT_TITLES} from '../shared/reports/director-report-bundle.mjs';
import {locationCountLabel} from '../shared/reports/in-out-report.mjs';
import {managerReportScope} from '../shared/masters/region-scope.mjs';

const now=new Date('2026-09-15T06:00:00Z');
const request={ref:'REQ-SASTI',door:'S-1',site:'SASTI',status:'Open',start:'2026-09-15 09:00:00'};

test('standalone Sasti is exposed only as Sasti OC in report filters and exports',()=>{
  const report=buildDepartmentReports({requests:[request],now})
    .find(({title})=>title==='Total Request Submitted Report');
  const location=report.columns.find(({key})=>key==='site');
  assert.equal(location.value(report.rows[0]),'Sasti OC');

  const director=buildDirectorReportTables({requests:[request],now})
    .find(({title})=>title===DIRECTOR_REPORT_TITLES[7]);
  const locationIndex=director.columns.findIndex(({key})=>key==='site');
  assert.equal(director.rows[0][locationIndex],'Sasti OC');
  assert.doesNotMatch(director.rows.flat().join('|'),/(?:^|\|)SASTI(?:\||$)/);
});

test('standalone and canonical Sasti values collapse into one visible location',()=>{
  assert.equal(locationCountLabel([{site:'SASTI'},{site:'Sasti OC'},{site:'Sasti II'}]),'Sasti OC (3)');
  assert.equal(managerReportScope({site:'SASTI'}).label,'Sasti OC');
  assert.equal(managerReportScope({managerSites:'SASTI | Sasti OC'}).label,'Sasti OC');
});
