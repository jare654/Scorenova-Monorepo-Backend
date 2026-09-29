import { ObjectLiteral, Repository } from "typeorm";
import { SelectQueryBuilder } from "typeorm";
import { FilterOperators } from "./filter_operators";
import { BadRequestException } from "@nestjs/common";
import { CollectionQuery } from "./collection-query";

// ─── Allowlist helpers ────────────────────────────────────────────────────────
// Validate that a field name only contains safe identifier characters.
// Prevents injection via sort/filter/select field names.
const SAFE_FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;

function assertSafeField(field: string): void {
  if (!SAFE_FIELD_RE.test(field)) {
    throw new BadRequestException(`Invalid field name: "${field}"`);
  }
}

export class QueryConstructor {
  static constructQuery<T extends ObjectLiteral>(
    q1: Repository<T>,
    query: CollectionQuery
  ): SelectQueryBuilder<T> {
    try {
      const langs = ["am", "en", "or"];
      const aggregateColumns: any = {};
      const propertyMap = new Map<string, string>();
      const metaData = q1.manager.connection.getMetadata(q1.target);
      metaData.columns.forEach((c) => {
        aggregateColumns[c.propertyName] = c.type;
        propertyMap.set(c.propertyName, c.propertyName);
        propertyMap.set(c.databaseName, c.propertyName);
      });
      const {
        top,
        skip,
        searchFrom,
        filter,
        search,
        orderBy,
        includes,
        select,
        locale,
        groupBy,
        withArchived,
      } = query;
      const aggregate = this.toSnackCase(metaData.tableName);
      const q = q1.createQueryBuilder(aggregate);
      if (select) {
        const selectArray = Array.isArray(select) ? select : [select];
        // Validate all select fields
        selectArray.forEach((s) => assertSafeField(s.split(".").pop()!));
        q.select(
          selectArray.map((s) => {
            return s.indexOf(".") === -1 ? `${aggregate}.${s}` : s;
          })
        );
      }
      if (includes) {
        const includesArray = Array.isArray(includes) ? includes : [includes];
        includesArray.forEach((include) => {
          if (include.includes(".")) {
            const item = include.split(".");
            const childTable = item[item.length - 1];
            q.leftJoinAndSelect(`${include}`, childTable);
          } else {
            q.leftJoinAndSelect(`${aggregate}.${include}`, include);
          }
        });
      }
      //Filtering goes here
      if (filter) {
        filter.forEach((filters, index) => {
          let filterString = "";
          const filterParams: any = {};
          filters.forEach((f: any, filterIndex) => {
            // Validate field name to prevent injection
            const rawField = f.field as string;
            assertSafeField(rawField.split(".").pop()!);
            const resolvedField = propertyMap.get(rawField) || rawField;
            const paramKey = filterIndex + "_" + index;
            const columnName =
              resolvedField.indexOf(".") === -1 ? `${aggregate}.${resolvedField}` : resolvedField;
            switch (f.operator) {
              case FilterOperators.EqualTo: {
                if (aggregateColumns[f.field] === "jsonb") {
                  langs.forEach((lang, i) => {
                    filterString +=
                      i === 0 && filterIndex === 0
                        ? ` ${columnName}->>'${lang}' = :${f.field}${lang}${paramKey} `
                        : ` OR ${columnName}->>'${lang}' = :${f.field}${lang}${paramKey} `;
                    filterParams[`${f.field}${lang}${paramKey}`] = f.value;
                  });
                } else {
                  filterString +=
                    filterIndex === 0
                      ? ` ${columnName} = :${f.field}${paramKey} `
                      : ` OR ${columnName} = :${f.field}${paramKey} `;
                  filterParams[`${f.field}${paramKey}`] = f.value;
                }
                break;
              }
              case FilterOperators.Between: {
                if (Array.isArray(f.value)) {
                  if (f.value.length >= 2) {
                    filterString +=
                      filterIndex === 0
                        ? ` (${columnName} between :${f.field}${paramKey}1 and :${f.field}${paramKey}2) `
                        : ` OR (${columnName} between :${f.field}${paramKey}1 and :${f.field}${paramKey}2) `;
                    filterParams[`${f.field}${paramKey}1`] = f.value[0];
                    filterParams[`${f.field}${paramKey}2`] = f.value[1];
                  }
                } else {
                  const values = f.value.split(",");
                  filterString +=
                    filterIndex === 0
                      ? ` (${columnName} between :${f.field}${paramKey}1 and :${f.field}${paramKey}2) `
                      : ` OR (${columnName} between :${f.field}${paramKey}1 and :${f.field}${paramKey}2) `;
                  filterParams[`${f.field}${paramKey}1`] = values[0];
                  filterParams[`${f.field}${paramKey}2`] = values[1];
                }
                break;
              }
              case FilterOperators.LessThan: {
                filterString +=
                  filterIndex === 0
                    ? ` ${columnName} < :${f.field}${paramKey} `
                    : ` OR ${columnName} < :${f.field}${paramKey} `;
                filterParams[`${f.field}${paramKey}`] = f.value;
                break;
              }
              case FilterOperators.LessThanOrEqualTo: {
                filterString +=
                  filterIndex === 0
                    ? ` ${columnName} <= :${f.field}${paramKey} `
                    : ` OR ${columnName} <= :${f.field}${paramKey} `;
                filterParams[`${f.field}${paramKey}`] = f.value;
                break;
              }
              case FilterOperators.GreaterThan: {
                filterString +=
                  filterIndex === 0
                    ? ` ${columnName} > :${f.field}${paramKey} `
                    : ` OR ${columnName} > :${f.field}${paramKey} `;
                filterParams[`${f.field}${paramKey}`] = f.value;

                break;
              }
              case FilterOperators.GreaterThanOrEqualTo: {
                filterString +=
                  filterIndex === 0
                    ? ` ${columnName} >= :${f.field}${paramKey} `
                    : ` OR ${columnName} >= :${f.field}${paramKey} `;
                filterParams[`${f.field}${paramKey}`] = f.value;

                break;
              }
              case FilterOperators.In: {
                if (Array.isArray(f.value)) {
                  filterString +=
                    filterIndex === 0
                      ? ` ${columnName} IN(:...${f.field}${paramKey}) `
                      : ` OR ${columnName} IN(:...${f.field}${paramKey}) `;
                  filterParams[`${f.field}${paramKey}`] = f.value;
                } else {
                  const values = f.value.split(",");
                  filterString +=
                    filterIndex === 0
                      ? ` ${columnName} IN(:...${f.field}${paramKey}) `
                      : ` OR ${columnName} IN(:...${f.field}${paramKey}) `;
                  filterParams[`${f.field}${paramKey}`] = values;
                }
                break;
              }
              case FilterOperators.Any: {
                if (Array.isArray(f.value)) {
                  filterString +=
                    filterIndex === 0
                      ? ` ${columnName} = ANY(:${f.field}${paramKey}) `
                      : ` OR ${columnName} = ANY(:${f.field}${paramKey}) `;
                  filterParams[`${f.field}${paramKey}`] = f.value;
                } else {
                  const values = f.value.split(",");
                  filterString +=
                    filterIndex === 0
                      ? ` ${columnName} = ANY(:${f.field}${paramKey}) `
                      : ` OR ${columnName} = ANY(:${f.field}${paramKey}) `;
                  filterParams[`${f.field}${paramKey}`] = values;
                }
                break;
              }
              case FilterOperators.NotNull: {
                filterString +=
                  filterIndex === 0
                    ? ` ${columnName} is not null `
                    : ` OR ${columnName} is not null `;
                break;
              }
              case FilterOperators.IsNull: {
                filterString +=
                  filterIndex === 0
                    ? ` ${columnName} is null `
                    : ` OR ${columnName} is null `;
                break;
              }

              case FilterOperators.NotEqualTo: {
                if (aggregateColumns[f.field] === "jsonb") {
                  langs.forEach((lang, i) => {
                    filterString +=
                      i === 0 && filterIndex === 0
                        ? ` ${columnName}->>'${lang}' != :${f.field}${lang}${paramKey} `
                        : ` OR ${columnName}->>'${lang}' != :${f.field}${lang}${paramKey} `;
                    filterParams[`${f.field}${lang}${paramKey}`] = f.value;
                  });
                } else {
                  filterString +=
                    filterIndex === 0
                      ? ` ${columnName} != :${f.field}${paramKey} `
                      : ` OR ${columnName} != :${f.field}${paramKey} `;
                  filterParams[`${f.field}${paramKey}`] = f.value;
                }
                break;
              }
              case FilterOperators.Like: {
                if (aggregateColumns[f.field] === "jsonb") {
                  langs.forEach((lang, i) => {
                    filterString +=
                      i === 0 && filterIndex === 0
                        ? ` ${columnName}->>'${lang}' ilike :${f.field}${lang}${paramKey} `
                        : ` OR ${columnName}->>'${lang}' ilike :${f.field}${lang}${paramKey} `;
                    filterParams[
                      `${f.field}${lang}${paramKey}`
                    ] = `%${f.value}%`;
                  });
                } else {
                  filterString +=
                    filterIndex === 0
                      ? ` ${columnName} ilike :${f.field}${paramKey} `
                      : ` OR ${columnName} ilike :${f.field}${paramKey} `;
                  filterParams[`${f.field}${paramKey}`] = `%${f.value}%`;
                }
                break;
              }
              case FilterOperators.NotIn:
                if (Array.isArray(f.value)) {
                  filterString +=
                    filterIndex === 0
                      ? ` ${columnName} NOT IN(:...${f.field}${paramKey}) `
                      : ` OR ${columnName} NOT IN(:...${f.field}${paramKey}) `;
                  filterParams[`${f.field}${paramKey}`] = f.value;
                } else {
                  const values = f.value.split(",");
                  filterString +=
                    filterIndex === 0
                      ? ` ${columnName} NOT IN(:...${f.field}${paramKey}) `
                      : ` OR ${columnName} NOT IN(:...${f.field}${paramKey}) `;
                  filterParams[`${f.field}${paramKey}`] = values;
                }
                break;
            }
          });
          index === 0
            ? q.where(`(${filterString})`, filterParams)
            : q.andWhere(`(${filterString})`, filterParams);
        });
      }
      if (search && searchFrom) {
        let searchQuery = "";
        const searchParams: any = {};
        searchFrom.forEach((item: string, index: number) => {
          // Validate search field name
          assertSafeField(item.split(".").pop()!);
          const searchColumn =
            item.indexOf(".") === -1 ? `${aggregate}.${item}` : item;
          const paramKey = "search_" + item;
          if (aggregateColumns[searchColumn] === "jsonb") {
            langs.forEach((lang, i) => {
              searchQuery +=
                i === 0 && index === 0
                  ? ` ${searchColumn}->>'${lang}' ilike :${paramKey}${lang} `
                  : ` OR ${searchColumn}->>'${lang}' ilike :${paramKey}${lang} `;
              searchParams[`${paramKey}${lang}`] = `%${search}%`;
            });
          } else {
            searchQuery +=
              index === 0
                ? ` ${searchColumn} ilike :${paramKey} `
                : ` OR ${searchColumn} ilike :${paramKey} `;
            searchParams[paramKey] = `%${search}%`;
          }
        });
        q.andWhere(`(${searchQuery})`, searchParams);
      }
      if (groupBy) {
        const groupArray = Array.isArray(groupBy) ? groupBy : [groupBy];
        groupArray.forEach((item, index) => {
          // Validate groupBy field name
          assertSafeField(item);
          index === 0
            ? q.groupBy(`${aggregate}.${item}`)
            : q.addGroupBy(`${aggregate}.${item}`);
        });
      }
      if (orderBy) {
        let orderArray: any[] = [];
        if (typeof orderBy === "string") {
          const dir = (query as any).direction?.toUpperCase() === "ASC" ? "ASC" : "DESC";
          orderArray = [{ field: orderBy, direction: dir }];
        } else if (Array.isArray(orderBy)) {
          orderArray = orderBy.map((item) => {
            if (typeof item === "string") {
              const dir = (query as any).direction?.toUpperCase() === "ASC" ? "ASC" : "DESC";
              return { field: item, direction: dir };
            }
            return item;
          });
        } else if (typeof orderBy === "object" && orderBy !== null) {
          orderArray = [orderBy];
        }

        const orderedBy: any = {};
        orderArray.forEach((order) => {
          if (!order || typeof order !== "object" || !order.field) return;
          const rawField = order.field as string;
          assertSafeField(rawField);
          const resolvedField = propertyMap.get(rawField) || propertyMap.get(rawField.split(".").pop()!) || rawField;
          const dir = order.direction?.toUpperCase();
          if (dir !== "ASC" && dir !== "DESC") {
            throw new BadRequestException(`Invalid sort direction: "${order.direction}"`);
          }
          orderedBy[`${aggregate}.${resolvedField}`] = dir;
        });
        if (Object.keys(orderedBy).length > 0) {
          q.orderBy(orderedBy);
        }
      }
      if (top) {
        q.take(top);
      }
      if (skip) {
        q.skip(skip);
      }
      if (withArchived && withArchived === true) {
        q.withDeleted();
      }
      return q;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error?.message || "Invalid query parameters.");
    }
  }
  static toSnackCase(text: string) {
    const result = text.trim().replace(/([A-Z])/g, " $1");
    const upperStr = result.split(" ");
    const lowerArray = upperStr.map((t) => {
      return t.toLocaleLowerCase();
    });
    return lowerArray.join("_");
  }
}
