import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class PSPAppsUrl {
  @PrimaryColumn("varchar")
  id!: string;

  @Column({ type: "varchar", nullable: false })
  identifier!: string;

  @Column({ type: "varchar", nullable: false })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: false })
  url!: string;

  @Column({ type: "varchar", length: 255, nullable: false })
  logoUrl!: string;
}