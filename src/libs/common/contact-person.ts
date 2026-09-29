import { ApiProperty } from "@nestjs/swagger";
// import { IsEmail, IsNotEmpty } from "class-validator";

// export class ContactPerson {
//   @ApiProperty()
//   @IsNotEmpty()
//   name: string;
//   @ApiProperty()
//   @IsNotEmpty()
//   @IsEmail()
//   email: string;
//   @ApiProperty()
//   @IsNotEmpty()
//   phoneNumber: string;
//   @ApiProperty()
//   @IsNotEmpty()
//   position: string;
// }

export class EmergencyContact {
  @ApiProperty()
  phoneNumber: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  city: string;
  @ApiProperty()
  state: string;
  @ApiProperty()
  zip: string;
  @ApiProperty()
  relationship: string;
}
export class ContactPerson {
  @ApiProperty()
  phoneNumber: string;
  @ApiProperty()
  name: string;
}
