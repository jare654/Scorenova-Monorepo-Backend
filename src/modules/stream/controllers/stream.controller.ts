import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { SkipThrottle } from "@nestjs/throttler";
import { StreamQueries } from "../usecases/streams/stream.usecase.queries";

@ApiTags("streams")
@ApiBearerAuth("Bearer")
@Controller("streams")
export class StreamController {
  constructor(
    private readonly streamQueries: StreamQueries,
  ) {}

  @Get()
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({
    summary: "List all curriculum streams",
    description: "Returns all curriculum streams (e.g. Natural Science, Social Science) available in the system.",
  })
  getStreams() {
    return this.streamQueries.getStreams();
  }
}
