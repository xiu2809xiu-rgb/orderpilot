import { Inject, Injectable } from "@nestjs/common";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { UserRepository } from "../../users/user.repository.js";

const MOST_USERS_OF_ONE_ROLE = 200;

/** Who could record a verification, going by the live matrix and enabled users. */
@Injectable()
export class BankHoldVerifiers {
  constructor(
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
    @Inject(UserRepository) private readonly users: UserRepository,
  ) {}

  async all(): Promise<ReadonlySet<string>> {
    const cells = await this.matrix.all();
    const pages = await Promise.all(
      cells
        .filter((cell) => cell.permission === "payments.confirm")
        .map(({ role }) =>
          this.users.list({
            role,
            active: "true",
            page: 1,
            pageSize: MOST_USERS_OF_ONE_ROLE,
          }),
        ),
    );
    return new Set(pages.flatMap((page) => page.items.map((user) => user.id)));
  }
}
