namespace OpenMoney.Core;

/// <summary>Regole comuni agli importi: solo euro, al centesimo.</summary>
public static class Money
{
    /// <summary>Tetto di prudenza: oltre è quasi certamente un errore di battitura.</summary>
    public const decimal Max = 999_999_999.99m;

    public static bool IsValid(decimal amount) =>
        Math.Abs(amount) <= Max && decimal.Round(amount, 2) == amount;
}
