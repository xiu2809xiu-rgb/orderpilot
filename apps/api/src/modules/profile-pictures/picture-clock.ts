import { Injectable } from "@nestjs/common";

/**
 * The time the picture rules use, behind a class so a test can pass one fixed
 * moment: the upload cap, the repeat check and every row's dates read it.
 * An abstract class so it is also the injection token.
 */
export abstract class PictureClock {
  abstract now(): Date;
}

@Injectable()
export class SystemPictureClock extends PictureClock {
  now(): Date {
    return new Date();
  }
}
