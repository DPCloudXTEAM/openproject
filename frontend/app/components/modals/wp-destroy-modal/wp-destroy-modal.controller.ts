//-- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2015 the OpenProject Foundation (OPF)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See doc/COPYRIGHT.rdoc for more details.
//++

import {wpControllersModule} from '../../../angular-modules';
import {States} from '../../states.service';
import {WorkPackageResource} from 'core-app/modules/hal/resources/work-package-resource';
import {WorkPackageTableFocusService} from 'core-components/wp-fast-table/state/wp-table-focus.service';
import {StateService} from '@uirouter/core';

export class WorkPackageDestroyModalController {
  public text:any;
  public workPackages:WorkPackageResource[];
  public workPackageLabel:string;

  constructor(private $scope:any,
              private $state:StateService,
              private states:States,
              private WorkPackageService:any,
              private wpTableFocus:WorkPackageTableFocusService,
              private I18n:op.I18n,
              private wpDestroyModal:any) {

    this.workPackages = $scope.workPackages;
    this.workPackageLabel = I18n.t('js.units.workPackage', { count: this.workPackages.length });

    this.text = {
      close: I18n.t('js.close_popup_title'),
      cancel: I18n.t('js.button_cancel'),
      confirm: I18n.t('js.button_confirm'),
      warning: I18n.t('js.label_warning'),

      title: I18n.t('js.modals.destroy_work_package.title', { label: this.workPackageLabel }),
      text: I18n.t('js.modals.destroy_work_package.text', { label: this.workPackageLabel, count: this.workPackages.length }),

      childCount: (wp:WorkPackageResource) => {
        const count = this.children(wp).length;
        return this.I18n.t('js.units.child_work_packages', {count: count});
      },
      hasChildren: (wp:WorkPackageResource) =>
        I18n.t('js.modals.destroy_work_package.has_children', {childUnits: this.text.childCount(wp) }),
      deletesChildren: I18n.t('js.modals.destroy_work_package.deletes_children')
    };
  }

  public $onInit() {
    // Created for interface compliance
  }

  public close() {
    try {
      this.wpDestroyModal.deactivate();
    } catch(e) {
      console.error("Failed to close deletion modal: " + e);
    }
  }

  public confirmDeletion() {
    this.wpDestroyModal.deactivate();
    this.WorkPackageService.performBulkDelete(this.workPackages.map(el => el.id), true)
      .then(() => {
        this.close();
        this.wpTableFocus.clear();
        this.$state.go('work-packages.list');
      });
  }

  public childLabel (workPackage:WorkPackageResource) {
  }

  public children(workPackage:WorkPackageResource) {
    if (workPackage.hasOwnProperty('children')) {
      return workPackage.children;
    } else {
      return [];
    }
  }

}

wpControllersModule.controller('WorkPackageDestroyModalController', WorkPackageDestroyModalController);
