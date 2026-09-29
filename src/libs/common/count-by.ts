import { ApiProperty } from "@nestjs/swagger";

export class CountByCreatedAtResponse {
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  count: number;
}
export class CountEarningsByCreatedAtResponse {
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  total: number;
}

export class CountWeeklyBookingByCreatedAtResponse {
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  total: number;
  @ApiProperty()
  numberOfTrips: number;
}
export class GroupBookingByStatusAndTransportResponse {
  @ApiProperty()
  transport: string;
  @ApiProperty()
  status: number;
  @ApiProperty()
  count: number;
}
export class CountBookingByAssignmentResponse {
  @ApiProperty()
  assignment: string;
  @ApiProperty()
  count: number;
}
export class CountBookingByRouteResponse {
  @ApiProperty()
  routeId: string;
  @ApiProperty()
  count: number;
}
export class GroupByStatusResponse {
  @ApiProperty()
  status: string;
  @ApiProperty()
  count: number;
}
export class GroupByTransportCompanyResponse {
  @ApiProperty()
  transportCompanyId: string;
  @ApiProperty()
  transportCompanyName: string;
  @ApiProperty()
  count: number;
}
export class GroupKidsByTransportCompanyResponse {
  @ApiProperty()
  transportCompanyName: string;
  @ApiProperty()
  routeName: string;
  @ApiProperty()
  count: number;
}
export class CountByCategoryResponse {
  @ApiProperty()
  category: string;
  @ApiProperty()
  count: number;
}
export class TransactionTotalResponse {
  @ApiProperty()
  total: number;
}
export class CountByGenderResponse {
  @ApiProperty()
  gender: string;
  @ApiProperty()
  count: number;
}
export class CountByViewsResponse {
  @ApiProperty()
  routeId: string;
  @ApiProperty()
  views: number;
}
export class CountAssignmentByRoute {
  @ApiProperty()
  routeId: string;
  @ApiProperty()
  routeName: string;
  @ApiProperty()
  pickupTime: string;
  @ApiProperty()
  availableSeats: string;
  @ApiProperty()
  count: number;
}
export class CountByStatusResponse {
  @ApiProperty()
  status: string;
  @ApiProperty()
  count: number;
}
export class GroupRouteByIdentifierResponse {
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  identifier: string;
  @ApiProperty()
  districtId: string;
  @ApiProperty()
  districtName: string;
  @ApiProperty()
  count: number;
}
export class GroupRouteByTransportCompanyResponse {
  @ApiProperty()
  transportName: string;
  @ApiProperty()
  count: number;
}
export class GroupRouteByNumberOfStudentsResponse {
  @ApiProperty()
  routeName: string;
  @ApiProperty()
  count: number;
}
export class CountByStatusAndRouteResponse {
  @ApiProperty()
  status: string;
  @ApiProperty()
  routeId: string;
  @ApiProperty()
  routeName: string;
  @ApiProperty()
  count: number;
}
export class CountEarningsByCategoryResponse {
  @ApiProperty()
  categoryId: string;
  @ApiProperty()
  categoryName: string;
  @ApiProperty()
  total: number;
}
export class CancellationReason {
  @ApiProperty()
  reason: string;
  @ApiProperty()
  cancelledBy: string;
  @ApiProperty()
  cancelledAt: Date;
}
export class GroupByAddressResponse {
  @ApiProperty()
  address: string;
  @ApiProperty()
  count: number;
}
