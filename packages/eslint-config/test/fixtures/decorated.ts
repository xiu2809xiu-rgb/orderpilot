// A Nest-style module: an empty class that exists to carry a decorator.
function Module(_options: object) {
  return (_target: new () => object): void => undefined;
}

@Module({})
export class ExampleModule {}
