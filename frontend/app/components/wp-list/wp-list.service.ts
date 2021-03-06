// -- copyright
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
// ++

import {QueryResource} from 'core-app/modules/hal/resources/query-resource';
import {QueryFormResource} from 'core-app/modules/hal/resources/query-form-resource';
import {States} from '../states.service';
import {ErrorResource} from 'core-app/modules/hal/resources/error-resource';
import {WorkPackageCollectionResource} from 'core-app/modules/hal/resources/wp-collection-resource';
import {WorkPackageTablePaginationService} from '../wp-fast-table/state/wp-table-pagination.service';
import {WorkPackagesListInvalidQueryService} from './wp-list-invalid-query.service';
import {WorkPackageStatesInitializationService} from './wp-states-initialization.service';
import {QueryMenuService} from 'core-components/wp-query-menu/wp-query-menu.service';
import {AuthorisationService} from 'core-components/common/model-auth/model-auth.service';
import {StateService} from '@uirouter/core';
import {WorkPackagesListChecksumService} from 'core-components/wp-list/wp-list-checksum.service';
import {LoadingIndicatorService} from 'core-components/common/loading-indicator/loading-indicator.service';
import {TableState} from 'core-components/wp-table/table-state/table-state';
import {Inject, Injectable} from '@angular/core';
import {
  I18nToken,
} from 'core-app/angular4-transition-utils';
import {QueryFormDmService} from 'core-app/modules/hal/dm-services/query-form-dm.service';
import {PaginationObject, QueryDmService} from 'core-app/modules/hal/dm-services/query-dm.service';
import {UrlParamsHelperService} from 'core-components/wp-query/url-params-helper';
import {NotificationsService} from 'core-components/common/notifications/notifications.service';
import {opServicesModule} from 'core-app/angular-modules';
import {downgradeInjectable} from '@angular/upgrade/static';

@Injectable()
export class WorkPackagesListService {
  constructor(protected NotificationsService:NotificationsService,
              @Inject(I18nToken) protected I18n:op.I18n,
              protected UrlParamsHelper:UrlParamsHelperService,
              protected authorisationService:AuthorisationService,
              protected $state:StateService,
              protected QueryDm:QueryDmService,
              protected QueryFormDm:QueryFormDmService,
              protected states:States,
              protected tableState:TableState,
              protected wpTablePagination:WorkPackageTablePaginationService,
              protected wpListChecksumService:WorkPackagesListChecksumService,
              protected wpStatesInitialization:WorkPackageStatesInitializationService,
              protected loadingIndicator:LoadingIndicatorService,
              protected wpListInvalidQueryService:WorkPackagesListInvalidQueryService,
              protected queryMenu:QueryMenuService) {
  }

  /**
   * Load a query.
   * The query is either a persisted query, identified by the query_id parameter, or the default query. Both will be modified by the parameters in the query_props parameter.
   */
  public async fromQueryParams(queryParams:any, projectIdentifier ?:string):Promise<QueryResource> {
    const queryData = this.UrlParamsHelper.buildV3GetQueryFromJsonParams(queryParams.query_props);
    const wpListPromise = this.QueryDm.find(queryData, queryParams.query_id, projectIdentifier);
    const promise = this.updateStatesFromQueryOnPromise(wpListPromise);

    promise
      .catch(async (error) => {
        const queryProps = this.UrlParamsHelper.buildV3GetQueryFromJsonParams(queryParams.query_props);

        return this.handleQueryLoadingError(error, queryProps, queryParams.query_id, projectIdentifier);
      });

    return this.conditionallyLoadForm(promise);
  }

  /**
   * Load the default query.
   */
  public async loadDefaultQuery(projectIdentifier ?:string):Promise<QueryResource> {
    return this.fromQueryParams({}, projectIdentifier);
  }

  /**
   * Reloads the current query and set the pagination to the first page.
   */
  public async reloadQuery(query:QueryResource):Promise<QueryResource> {
    let pagination = this.getPaginationInfo();
    pagination.offset = 1;

    let wpListPromise = this.QueryDm.reload(query, pagination);

    let promise = this.updateStatesFromQueryOnPromise(wpListPromise);

    promise
      .catch(async (error) => {
        let projectIdentifier = query.project && query.project.id;

        return this.handleQueryLoadingError(error, {}, query.id, projectIdentifier);
      });

    return this.conditionallyLoadForm(promise);
  }

  /**
   * Update the list from an existing query object.
   */
  public async loadResultsList(query:QueryResource, additionalParams:PaginationObject):Promise<WorkPackageCollectionResource> {
    let wpListPromise = this.QueryDm.loadResults(query, additionalParams);

    return this.updateStatesFromWPListOnPromise(query, wpListPromise);
  }

  /**
   * Reload the list of work packages for the current query keeping the
   * pagination options.
   */
  public async reloadCurrentResultsList():Promise<WorkPackageCollectionResource> {
    let pagination = this.getPaginationInfo();
    let query = this.currentQuery;

    return this.loadResultsList(query, pagination);
  }

  /**
   * Reload the first page of work packages for the current query
   */
  public async loadCurrentResultsListFirstPage():Promise<WorkPackageCollectionResource> {
    let pagination = this.getPaginationInfo();
    pagination.offset = 1;
    let query = this.currentQuery;

    return this.loadResultsList(query, pagination);
  }

  /**
   * Load the query from the given state params
   * @param stateParams
   */
  public loadCurrentQueryFromParams(projectIdentifier?:string) {
    this.wpListChecksumService.clear();
    this.loadingIndicator.table.promise =
      this.fromQueryParams(this.$state.params, projectIdentifier).then(() => {
        return this.tableState.rendered.valuesPromise();
      });
  }

  public async loadForm(query:QueryResource):Promise<QueryFormResource> {
    return this.QueryFormDm.load(query).then((form:QueryFormResource) => {
      this.wpStatesInitialization.updateStatesFromForm(query, form);

      return form;
    });
  }

  /**
   * Persist the current query in the backend.
   * After the update, the new query is reloaded (e.g. for the work packages)
   */
  public async create(query:QueryResource, name:string):Promise<QueryResource> {
    let form = this.states.query.form.value!;

    query.name = name;

    let promise = this.QueryDm.create(query, form);

    promise
      .then(query => {
        this.NotificationsService.addSuccess(this.I18n.t('js.notice_successful_create'));
        this.reloadQuery(query);
        return query;
      });

    return promise;
  }

  /**
   * Destroy the current query.
   */
  public async delete() {
    let query = this.currentQuery;

    let promise = this.QueryDm.delete(query);

    promise
      .then(() => {
        this.NotificationsService.addSuccess(this.I18n.t('js.notice_successful_delete'));

        this.removeMenuItem(query);

        let id;
        if (query.project) {
          id = query.project.$href!.split('/').pop();
        }

        this.loadDefaultQuery(id);
      });

    return promise;
  }

  public async save(query?:QueryResource) {
    query = query || this.currentQuery;

    let form = this.states.query.form.value!;

    let promise = this.QueryDm.update(query, form);

    promise
      .then(() => {
        this.NotificationsService.addSuccess(this.I18n.t('js.notice_successful_update'));

        this
          .queryMenu
          .rename(query!.id.toString(), query!.name);

        // We should actually put the query newly received
        // from the backend in here.
        // But the backend does currently not return work packages (results).
        this.states.query.resource.putValue(query!);
      })
      .catch((error:ErrorResource) => {
        this.NotificationsService.addError(error.message);
      });

    return promise;
  }

  public async toggleStarred(query:QueryResource):Promise<any> {
    let promise = this.QueryDm.toggleStarred(query);

    promise.then((query:QueryResource) => {
      this.states.query.resource.putValue(query);

      this.NotificationsService.addSuccess(this.I18n.t('js.notice_successful_update'));

      this.updateQueryMenu();
    });

    return promise;
  }

  private getPaginationInfo() {
    let pagination = this.wpTablePagination.current;

    return {
      pageSize: pagination.perPage,
      offset: pagination.page
    };
  }

  private async conditionallyLoadForm(promise:Promise<QueryResource>):Promise<QueryResource> {
    promise.then(query => {

      let currentForm = this.states.query.form.value;

      if (!currentForm || query.$links.update.$href !== currentForm.$href) {
        setTimeout(async () => this.loadForm(query), 0);
      }

      return query;
    });

    return promise;
  }

  private async updateStatesFromQueryOnPromise(promise:Promise<QueryResource>):Promise<QueryResource> {
    promise
      .then(query => {
        this.tableState.ready.doAndTransition('Query loaded', () => {
          this.wpStatesInitialization.initialize(query, query.results);
          return this.tableState.tableRendering.onQueryUpdated.valuesPromise();
        });

        return query;
      });

    return promise;
  }

  private async updateStatesFromWPListOnPromise(query:QueryResource, promise:Promise<WorkPackageCollectionResource>):Promise<WorkPackageCollectionResource> {
    return promise.then((results) => {
      this.tableState.ready.doAndTransition('Query loaded', () => {
        this.wpStatesInitialization.updateTableState(query, results);
        this.wpStatesInitialization.updateChecksum(query, results);
        return this.tableState.tableRendering.onQueryUpdated.valuesPromise();
      });

      return results;
    });
  }

  private get currentQuery() {
    return this.states.query.resource.value!;
  }

  private updateQueryMenu() {
    let query = this.currentQuery;

    if (query.starred) {
      this.createMenuItem(query);
    } else {
      this.removeMenuItem(query);
    }
  }

  private async handleQueryLoadingError(error:ErrorResource, queryProps:any, queryId:number, projectIdentifier?:string) {
    this.NotificationsService.addError(this.I18n.t('js.work_packages.faulty_query.description'), error.message);

    return new Promise((resolve, reject) => {
      this.QueryFormDm.loadWithParams(queryProps, queryId, projectIdentifier)
        .then(form => {
          this.QueryDm.findDefault({pageSize: 0}, projectIdentifier)
            .then((query:QueryResource) => {
              this.wpListInvalidQueryService.restoreQuery(query, form);

              query.results.pageSize = queryProps.pageSize;
              query.results.total = 0;

              if (queryId) {
                query.id = queryId;
              }

              this.tableState.ready.doAndTransition('Query loaded', () => {
                this.wpStatesInitialization.initialize(query, query.results);
                this.wpStatesInitialization.updateStatesFromForm(query, form);

                return this.tableState.tableRendering.onQueryUpdated.valuesPromise();
              });

              resolve(query);
            })
            .catch(reject);
        })
        .catch(reject);
    });
  }

  private createMenuItem(query:QueryResource) {
    return this
      .queryMenu
      .add(query.name,
        this.$state.href('work-packages.list', {query_id: query.id}),
        query.id.toString());
  }

  private removeMenuItem(query:QueryResource) {
    return this
      .queryMenu
      .remove(query.id.toString());
  }
}

opServicesModule.service('wpListService', downgradeInjectable(WorkPackagesListService));
