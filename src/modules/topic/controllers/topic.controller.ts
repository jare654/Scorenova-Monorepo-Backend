import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { TopicQueries } from "../usecases/topics/topic.usecase.queries";
import { TopicCommands } from "../usecases/topics/topic.usecase.commands";
import { CreateTopicDto, UpdateTopicDto, UpdateTopicAccessDto } from "../usecases/topics/topic.commands";
import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { SkipThrottle } from "@nestjs/throttler";

@ApiTags("topics")
@ApiBearerAuth("Bearer")
@Controller("topics")
export class TopicController {
  constructor(
    private readonly topicQueries: TopicQueries,
    private readonly topicCommands: TopicCommands,
  ) {}

  @Get()
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({
    summary: "List topics by subject",
    description: "Retrieves all curriculum topics belonging to specified subjectId.",
  })
  getTopics(@Query("subjectId") subjectId: string) {
    return this.topicQueries.getTopicsBySubject(subjectId);
  }

  @Post()
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Create a new topic (Admin only)",
    description: "Creates a new subject topic under specified subjectId.",
  })
  createTopic(@Body() dto: CreateTopicDto) {
    return this.topicCommands.createTopic(dto);
  }

  @Patch(":id/access")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Update topic access type (Free or Paid) (Admin only)",
    description: "Allows admin to dynamically toggle a topic between free and paid access.",
  })
  updateTopicAccess(@Param("id") id: string, @Body() dto: UpdateTopicAccessDto) {
    return this.topicCommands.updateTopic(id, dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Update a topic (Admin only)",
    description: "Updates name or subject association for specified topic ID.",
  })
  updateTopic(@Param("id") id: string, @Body() dto: UpdateTopicDto) {
    return this.topicCommands.updateTopic(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Delete a topic (Admin only)",
    description: "Deletes specified topic from database.",
  })
  deleteTopic(@Param("id") id: string) {
    return this.topicCommands.deleteTopic(id);
  }
}
