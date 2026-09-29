import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";

@ApiTags("system")
@Controller("/")
export class AppController {
  private readonly startedAt = new Date();

  @Get("status")
  @AllowAnonymous()
  @ApiOperation({
    summary: "API Health & System Status",
    description: "Returns server status, uptime, environment, Node version, memory usage, and startup timestamp.",
  })
  getStatus() {
    const mem = process.memoryUsage();
    
    return {
      status: "ok",
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "0.0.1",
      node: process.version,
      uptime: `${Math.floor(process.uptime())}s`,
      memory: {
        rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
        heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
      },
      startedAt: this.startedAt.toISOString(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("get-date")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Get server current date and time",
    description: "Returns ISO date string of current server clock time.",
  })
  getDate(): Date {
    return new Date();
  }
}
