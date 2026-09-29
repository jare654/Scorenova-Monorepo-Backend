import { ApiProperty } from "@nestjs/swagger";

export class BaseResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt?: Date;

  @ApiProperty()
  createdBy?: string;

  @ApiProperty()
  updatedBy?: string;

  @ApiProperty()
  deletedBy?: string;

  static fromEntity<T>(entity: T): BaseResponse {
    const response = new BaseResponse();
    // Map common properties here if applicable
    // Example (you may need to adjust based on your entity structure):
    response.id = (entity as any).id;
    response.createdAt = (entity as any).createdAt;
    response.updatedAt = (entity as any).updatedAt;
    response.deletedAt = (entity as any).deletedAt;
    response.createdBy = (entity as any).createdBy;
    response.updatedBy = (entity as any).updatedBy;
    response.deletedBy = (entity as any).deletedBy;
    return response;
  }
}
