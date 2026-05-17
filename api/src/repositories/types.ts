import type { QueryResult, QueryResultRow } from "pg";

export type Queryable = {
  query: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<QueryResult<R>>;
};
