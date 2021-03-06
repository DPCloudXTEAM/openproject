#-- copyright
# OpenProject is a project management system.
# Copyright (C) 2012-2018 the OpenProject Foundation (OPF)
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#
# OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
# Copyright (C) 2006-2017 Jean-Philippe Lang
# Copyright (C) 2010-2013 the ChiliProject Team
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#
# See docs/COPYRIGHT.rdoc for more details.
#++

require 'spec_helper'
require 'features/projects/project_settings_page'

describe 'form subelements configuration', type: :feature, js: true do
  let(:admin) { FactoryGirl.create :admin }
  let(:type_bug) { FactoryGirl.create :type_bug }
  let(:type_task) { FactoryGirl.create :type_task }

  let(:project) { FactoryGirl.create :project, types: [type_bug, type_task] }
  let!(:work_package) do
    FactoryGirl.create :work_package,
                       project: project,
                       type: type_bug
  end
  let!(:subtask) do
    FactoryGirl.create :work_package,
                       parent: work_package,
                       project: project,
                       type: type_task
  end
  let!(:subbug) do
    FactoryGirl.create :work_package,
                       parent: work_package,
                       project: project,
                       type: type_bug
  end

  let(:wp_page) { Pages::FullWorkPackage.new(work_package) }
  let(:form) { ::Components::Admin::TypeConfigurationForm.new }
  let(:modal) { ::Components::WorkPackages::TableConfigurationModal.new }
  let(:filters) { ::Components::WorkPackages::TableConfiguration::Filters.new }

  describe "with EE token" do
    before do
      with_enterprise_token(:edit_attribute_groups)
      login_as(admin)
      visit edit_type_tab_path(id: type_bug.id, tab: "form_configuration")
    end

    it 'can create and save embedded subelements' do
      form.add_query_group('Subtasks')
      form.edit_query_group('Subtasks')

      # Restrict filters to type_task
      modal.expect_open
      filters.expect_filter_count 1
      filters.add_filter_by('Type', 'is', type_task.name)
      filters.save

      form.save_changes
      expect(page).to have_selector('.flash.notice', text: 'Successful update.', wait: 10)

      # Visit work package with that type
      wp_page.visit!
      wp_page.ensure_page_loaded

      wp_page.expect_group('Subtasks')
      table_container = find(".attributes-group[data-group-name='Subtasks']")
                        .find('.work-packages-embedded-view--container')
      embedded_table = Pages::EmbeddedWorkPackagesTable.new(table_container)
      embedded_table.expect_work_package_listed subtask
      embedded_table.expect_work_package_not_listed subbug

      # Go back to type configuration
      visit edit_type_tab_path(id: type_bug.id, tab: "form_configuration")

      # Edit query to remove filters
      form.edit_query_group('Subtasks')

      # Expect filter still there
      modal.expect_open
      filters.expect_filter_count 2
      filters.expect_filter_by 'Type', 'is', type_task.name

      # Remove the filter again
      filters.remove_filter 'type'
      filters.save

      # Save changes
      form.save_changes

      # Visit wp_page again, expect both listed
      wp_page.visit!
      wp_page.ensure_page_loaded

      wp_page.expect_group('Subtasks') do
        embedded_table = Pages::EmbeddedWorkPackagesTable.new(find('.work-packages-embedded-view--container'))
        embedded_table.expect_work_package_listed subtask, subbug
      end
    end
  end
end
