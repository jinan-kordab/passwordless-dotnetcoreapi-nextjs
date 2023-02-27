var builder = WebApplication.CreateBuilder(args);
// Add services to the container.
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(
               builder =>
               {
                   builder.WithOrigins("http://localhost:3000")
                   .SetIsOriginAllowedToAllowWildcardSubdomains()
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials()
              .WithMethods("GET", "PUT", "POST", "DELETE", "OPTIONS")
              .SetPreflightMaxAge(TimeSpan.FromSeconds(3600));
               });

    options.AddPolicy("PasswordlessCorsPolicy",
        policy =>
        {
            policy.WithOrigins("http://localhost:3000", "http://192.168.2.224:3000")
             .SetIsOriginAllowedToAllowWildcardSubdomains()
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials()
              .WithMethods("GET", "PUT", "POST", "DELETE", "OPTIONS")
              .SetPreflightMaxAge(TimeSpan.FromSeconds(3600));
        });
});

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddFido2(options =>
{
    options.ServerDomain = "localhost";
    options.ServerName = "Passwordless Demo API";
    options.Origin = "http://localhost:3000";
    options.TimestampDriftTolerance = 300000;
});
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromSeconds(10);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});
builder.Services.AddDataProtection();
var app = builder.Build();

app.UseCors("PasswordlessCorsPolicy");
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthorization();
app.UseSession();
app.MapControllers();
app.Run();
