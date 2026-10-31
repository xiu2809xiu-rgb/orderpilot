// A Nest-style module: an empty class that exists to carry a decorator.
function Module(options: object) {
  return (target: new () => object): void => {
    Object.assign(target, options);
  };
}

@Module({})
export class ExampleModule {}
