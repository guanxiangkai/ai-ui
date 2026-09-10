/** 平台列表接口共享的分页字段。 */
export interface PlatformPage<T, TPage extends number | undefined = number> {
  /** 当前页记录。 */
  records: T[];
  /** 满足查询条件的记录总数。 */
  total: number;
  /** 当前页码；缺省语义由具体接口约定。 */
  pageNum?: TPage;
  /** 当前页大小；缺省语义由具体接口约定。 */
  pageSize?: TPage;
}

/** 平台实体的稳定标识。 */
export interface PlatformIdentity {
  /** 实体标识。 */
  id: string;
}

/** 平台实体的创建时间。 */
export interface PlatformCreatedFields<TTime = string> {
  /** 创建时间，具体协议决定可空性。 */
  createTime?: TTime;
}

/** 平台实体的创建与更新时间。 */
export interface PlatformAuditFields<TTime = string> extends PlatformCreatedFields<TTime> {
  /** 最后更新时间，具体协议决定可空性。 */
  updateTime?: TTime;
}
