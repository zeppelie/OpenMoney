namespace OpenMoney.Api;

/// <summary>Errori di validazione come codici: li traduce il frontend.</summary>
internal static class Problems
{
    /// <summary>Null se non ci sono errori.</summary>
    public static IResult? From(IEnumerable<string> codes) => codes.Distinct().ToArray() is { Length: > 0 } found ? Of(found) : null;

    public static IResult Of(params string[] codes) =>
        Results.ValidationProblem(codes.ToDictionary(code => code, code => new[] { code }));
}
