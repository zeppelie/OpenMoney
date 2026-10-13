using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenMoney.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RicorrenzeEAddebitoCarte : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "SettledThrough",
                table: "Accounts",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SettlementAccountId",
                table: "Accounts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SettlementDay",
                table: "Accounts",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Recurrences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Frequency = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Occurrences = table.Column<int>(type: "integer", nullable: true),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    GeneratedCount = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AuthorId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Recurrences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Recurrences_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Recurrences_Accounts_ToAccountId",
                        column: x => x.ToAccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Recurrences_AspNetUsers_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Recurrences_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_SettlementAccountId",
                table: "Accounts",
                column: "SettlementAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Recurrences_AccountId",
                table: "Recurrences",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Recurrences_AuthorId",
                table: "Recurrences",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_Recurrences_CategoryId",
                table: "Recurrences",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Recurrences_ToAccountId",
                table: "Recurrences",
                column: "ToAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Accounts_Accounts_SettlementAccountId",
                table: "Accounts",
                column: "SettlementAccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Accounts_Accounts_SettlementAccountId",
                table: "Accounts");

            migrationBuilder.DropTable(
                name: "Recurrences");

            migrationBuilder.DropIndex(
                name: "IX_Accounts_SettlementAccountId",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "SettledThrough",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "SettlementAccountId",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "SettlementDay",
                table: "Accounts");
        }
    }
}
