#-- encoding: UTF-8

#-- copyright
# OpenProject is a project management system.
# Copyright (C) 2012-2017 the OpenProject Foundation (OPF)
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
# See doc/COPYRIGHT.rdoc for more details.
#++

module API
  module Caching
    class CacheChecksumWrapper < SimpleDelegator
      attr_accessor :work_package,
                    :cache_checksum

      def initialize(work_package, checksum)
        super(work_package)
        self.work_package = work_package
        self.cache_checksum = checksum
      end
      private_class_method :new

      def self.wrap(work_packages)
        concat = <<-SQL
          MD5(CONCAT(statuses.id, 
                     statuses.updated_at, 
                     users.id, 
                     users.updated_on, 
                     responsibles_work_packages.id, 
                     responsibles_work_packages.updated_on, 
                     assigned_tos_work_packages.id, 
                     assigned_tos_work_packages.updated_on, 
                     versions.id, 
                     versions.updated_on,
                     enumerations.id,
                     enumerations.updated_at,
                     categories.id,
                     categories.updated_at))
        SQL

        checksums = WorkPackage
                    .where(id: work_packages.map(&:id).uniq)
                    .left_joins(:status, :author, :responsible, :assigned_to, :fixed_version, :priority, :category)
                    .pluck('work_packages.id', concat)
                    .group_by(&:first)

        work_packages.map do |work_package|
          new(work_package, checksums[work_package.id].last.last)
        end
      end
    end
  end
end
