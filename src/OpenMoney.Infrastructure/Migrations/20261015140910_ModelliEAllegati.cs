using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenMoney.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ModelliEAllegati : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MovementId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Attachments_Movements_MovementId",
                        column: x => x.MovementId,
                        principalTable: "Movements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MovementTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MovementTemplates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MovementTemplates_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MovementTemplates_Accounts_ToAccountId",
                        column: x => x.ToAccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MovementTemplates_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_MovementId",
                table: "Attachments",
                column: "MovementId");

            migrationBuilder.CreateIndex(
                name: "IX_MovementTemplates_AccountId",
                table: "MovementTemplates",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_MovementTemplates_CategoryId",
                table: "MovementTemplates",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_MovementTemplates_ToAccountId",
                table: "MovementTemplates",
                column: "ToAccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Attachments");

            migrationBuilder.DropTable(
                name: "MovementTemplates");
        }
    }
}
