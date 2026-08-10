import { Entity, PrimaryColumn, Column } from "typeorm";

export enum TransactionStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILURE = "failure",
}

@Entity()
export class PaymentLink {
  @PrimaryColumn("varchar")
  id!: string;

  @Column("varchar")
  intentURL!: string;

  @Column("varchar")
  allowedIP!: string;

  @Column("datetime", { default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column("datetime", { default: () => "CURRENT_TIMESTAMP" })
  expireAt!: Date;

  @Column({ type: "varchar", default: TransactionStatus.PENDING })
  status!: TransactionStatus;

  @Column({ type: "datetime", nullable: true })
  clickedAt!: Date | null;

  @Column({ type: "varchar", nullable: true })
  clickedBy!: string | null;

  @Column({ type: "varchar", nullable: true })
  callbackUrl!: string | null;

  @Column({ type: "varchar", nullable: true })
  orderId!: string | null;

  @Column({ type: "varchar", nullable: true })
  errorMessage!: string | null;
}
