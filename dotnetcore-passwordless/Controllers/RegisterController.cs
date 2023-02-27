using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using Fido2NetLib;
using Fido2NetLib.Development;
using Fido2NetLib.Objects;
using System.Text;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Cors;
using Microsoft.Extensions.Caching.Memory;

namespace dotnetcore_passwordless.Controllers;

public interface Passwordless
{
    JsonResult Register(User usr, HttpContext httpContext, IMemoryCache _cache);
    public delegate bool IsCredentialUnique(IsCredentialIdUniqueToUserParams userParams);
    JsonResult SignIn(User usr, HttpContext httpContext, IMemoryCache _cache);
    public void SetAliases(string[] aliases);
    public void ListCredentials(string userid);
    public void DeleteCredential(string credentialid);
}

public class User
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? UserName { get; set; }
    public string? DisplayName { get; set; }
    public string[]? Aliases { get; set; }

    public string? attestation_type { get; set; }
    public string? authenticator_attachment { get; set; }
    public string? user_verification { get; set; }
    public string? residentKey { get; set; }
    public string? CredentialId { get; set; }
    public string? PasswordlessPublicKey { get; set; }

}

public class SignInAuthResponse
{
    public string? id { get; set; }
    public string? rawId { get; set; }
    public string? type { get; set; }
    public string? extensions { get; set; }
    public response? response { get; set; }
}

public class response
{
    public string? authenticatorData { get; set; }
    public string? clientDataJson { get; set; }
    public string? signature { get; set; }
}

public class returnedResult
{
    public string? firstName { get; set; }
    public string? lastName { get; set; }
    public string? data { get; set; }
    public string? status { get; set; }
}

public class PasswordlessWorker : Passwordless
{
    private readonly IFido2 fido2;
    public PasswordlessWorker(IFido2 fido2)
    {
        this.fido2 = fido2;
    }
    public JsonResult Register(User user, HttpContext httpContext, IMemoryCache _cache)
    {
        // // possible values: none, direct, indirect
        // user.attestation_type = "none";

        // // possible values: <empty>, platform, cross-platform
        // user.authenticator_attachment = "";

        // // possible values: preferred, required, discouraged
        // user.user_verification = "preferred";

        // // possible values: discouraged, preferred, required
        // user.residentKey = "discouraged";
        var newuser = new Fido2User
        {
            DisplayName = $"{user.FirstName} {user.LastName}",
            Name = user.Email,
            Id = Encoding.UTF8.GetBytes(user.Email)
        };

        var options = fido2.RequestNewCredential(newuser, new List<PublicKeyCredentialDescriptor>());

        var cacheEntryOptions = new MemoryCacheEntryOptions()
                    .SetSlidingExpiration(TimeSpan.FromSeconds(60))
                    .SetAbsoluteExpiration(TimeSpan.FromSeconds(3600))
                    .SetPriority(CacheItemPriority.Normal)
                    .SetSize(1024);
        _cache.Set("fido2.attestationOptions", options.ToJson(), cacheEntryOptions);

        return new JsonResult(new { Result = options });
    }

    public JsonResult SignIn(User user, HttpContext httpContext, IMemoryCache _cache)
    {
        try
        {
            var _Login = user.UserName;
            MongoClient dbClient = new MongoClient("PLACE YOUR MONGO CONNECTION STRING HERE");
            IMongoDatabase database = dbClient.GetDatabase("users");

            var collection = database.GetCollection<BsonDocument>("appusers");
            var filter = new BsonDocument {
                    {"Login", _Login},
                    };
            var userFound = collection.Find(filter).FirstOrDefault();

            string userNotFoundMsg = "";
            if (userFound == null)
            {
                userNotFoundMsg = "Please register first";
            }
            if (userNotFoundMsg == "")
            {
                var tempPasswordlessPublicKey = userFound["PasswordlessPublicKey"].ToString();
                var credential = JsonConvert.DeserializeObject<StoredCredential>(userFound["PasswordlessPublicKey"].ToString());
                var tempcredentialdescriptor = credential.Descriptor;
                var options = fido2.GetAssertionOptions(new List<PublicKeyCredentialDescriptor> { credential.Descriptor }, UserVerificationRequirement.Discouraged);

                var cacheEntryOptions = new MemoryCacheEntryOptions()
                   .SetSlidingExpiration(TimeSpan.FromSeconds(60))
                   .SetAbsoluteExpiration(TimeSpan.FromSeconds(3600))
                   .SetPriority(CacheItemPriority.Normal)
                   .SetSize(1024);
                _cache.Set("fido2.assertionOptions", options.ToJson(), cacheEntryOptions);
                return new JsonResult(new { Result = options });
            }
            return new JsonResult(new { Result = "" + userNotFoundMsg + "" });
        }

        catch (Exception e)
        {
            return new JsonResult(new AssertionOptions { Status = "error", ErrorMessage = e.Message });
        }
    }
    public void SetAliases(string[] aliases)
    {
        throw new NotImplementedException();
    }
    public void ListCredentials(string userid)
    {
        throw new NotImplementedException();
    }
    public void DeleteCredential(string credentialid)
    {
        throw new NotImplementedException();
    }
}

public abstract class AppUser
{
    public Passwordless passwordless;
    protected User user;
    private HttpContext httpContext;
    private IMemoryCache cache;

    public AppUser(Passwordless pwdless, User usr, HttpContext _httpContext, IMemoryCache _cache)
    {
        this.passwordless = pwdless;
        this.user = usr;
        this.httpContext = _httpContext;
        this.cache = _cache;
    }
    public abstract JsonResult Register();
    public abstract JsonResult Login();
    public abstract void ListCredentials(string userid);
}

public class ExistingUser : AppUser
{
    private new Passwordless passwordless;
    private User usr;
    private HttpContext httpContext;
    IMemoryCache cache;
    public ExistingUser(Passwordless password_less, User _usr, HttpContext _httpContext, IMemoryCache _cache) : base(password_less, _usr, _httpContext, _cache)
    {
        passwordless = password_less;
        usr = _usr;
        httpContext = _httpContext;
        cache = _cache;
    }
    public override JsonResult Login()
    {
        return passwordless.SignIn(usr, httpContext, cache);
    }
    public override void ListCredentials(string userid)
    {
        passwordless.ListCredentials(userid);
    }
    public override JsonResult Register()
    {
        return passwordless.Register(usr, httpContext, cache);
    }
}

public class NewUser : AppUser
{
    private new Passwordless passwordless;
    private HttpContext httpContext;
    private User usr;
    private IMemoryCache cache;
    public NewUser(Passwordless password_less, User _usr, HttpContext _httpContext, IMemoryCache _cache) : base(password_less, _usr, _httpContext, _cache)
    {
        passwordless = password_less;
        usr = _usr;
        httpContext = _httpContext;
        cache = _cache;
    }
    public override void ListCredentials(string userid)
    {
        passwordless.ListCredentials(userid);
    }
    public override JsonResult Login()
    {
        return passwordless.SignIn(usr, httpContext, cache);
    }
    public override JsonResult Register()
    {
        return passwordless.Register(usr, httpContext, cache);
    }
}

[ApiController]
[Route("[controller]")]
public class RegisterController : ControllerBase
{
    private readonly IFido2 fido2;
    private readonly IHttpContextAccessor _accessor;
    private IMemoryCache _cache;
    public RegisterController(IFido2 fido2, IHttpContextAccessor accessor, IMemoryCache cache)
    {
        this.fido2 = fido2;
        this._accessor = accessor;
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    }

    [EnableCors("PasswordlessCorsPolicy")]
    [Route("[action]")]
    [HttpPost]
    public JsonResult Register([FromBody] User usr)
    {
        var context = _accessor.HttpContext;

        //Before registering, check if the user already exists in database
        //Verify by email - username
        MongoClient dbClient = new MongoClient("PLACE YOUR MONGO CONNECTION STRING HERE");
        IMongoDatabase database = dbClient.GetDatabase("users");
        var collection = database.GetCollection<BsonDocument>("appusers");
        var filter = new BsonDocument { { "Email", usr.Email }, };
        var userFound = collection.Find(filter).FirstOrDefault();
        if (userFound == null)
        {
            if (usr == null)
                return new JsonResult(BadRequest());

            //add logic to call the logic
            Passwordless pwdless = new PasswordlessWorker(fido2);
            NewUser newUser = new NewUser(pwdless, usr, context, _cache);
            return newUser.Register();
        }
        else
        {
            return new JsonResult(new { Result = "User with this email - username already exists. Please sign in or register with different email - username" });
        }
    }

    [EnableCors("PasswordlessCorsPolicy")]
    [Route("[action]")]
    [HttpPost]
    public IActionResult Login([FromBody] User usr)
    {
        var context = _accessor.HttpContext;

        if (usr == null)
            return BadRequest();

        Passwordless pwdless = new PasswordlessWorker(fido2);
        ExistingUser existingUser = new ExistingUser(pwdless, usr, context, _cache);
        return existingUser.Login();

    }
    [EnableCors("PasswordlessCorsPolicy")]
    [Route("[action]")]
    [HttpPost]
    public async Task<JsonResult> SaveCredentials([FromBody] Object attestationResponse)
    {
        var jsonString = System.Text.Json.JsonSerializer.Serialize(attestationResponse);
        var rootObject = JsonConvert.DeserializeObject<AuthenticatorAttestationRawResponse>(jsonString);
        var httpContext = _accessor.HttpContext;

        try
        {
            MongoClient dbClient = new MongoClient("PLACE YOUR MONGO CONNECTION STRING HERE");
            IMongoDatabase database = dbClient.GetDatabase("users");
            var collection = database.GetCollection<BsonDocument>("appusers");

            var jsonOptions = _cache.Get("fido2.attestationOptions");

            var options = CredentialCreateOptions.FromJson(jsonOptions.ToString());
            var fidoCredentials = await fido2.MakeNewCredentialAsync(rootObject, options, IsCredentialUnique);
            var storedCredential = new StoredCredential
            {
                Descriptor = new PublicKeyCredentialDescriptor(fidoCredentials.Result.CredentialId),
                PublicKey = fidoCredentials.Result.PublicKey,
                UserHandle = fidoCredentials.Result.User.Id,
                SignatureCounter = fidoCredentials.Result.Counter,
                CredType = fidoCredentials.Result.CredType,
                RegDate = DateTime.Now,
                AaGuid = fidoCredentials.Result.Aaguid
            };

            var names = options.User.DisplayName.Split(' ');
            // Add new user to mongo db
            var newusertoadd = new BsonDocument {
                        {"Login", options.User.Name },
                        {"Email", options.User.Name},
                        {"DisplayName",options.User.DisplayName},
                        {"FirstName",names[0]},
                        {"LastName", names[1]},
                        {"CredentialId", Convert.ToBase64String(fidoCredentials.Result.CredentialId)},
                        {"PasswordlessPublicKey",JsonConvert.SerializeObject(storedCredential)},
                        };
            await collection.InsertOneAsync(newusertoadd);
            return new JsonResult(fidoCredentials);
        }
        catch (Exception e)
        {
            return new JsonResult(new String(e.Message));
        }
    }
    private async Task<bool> IsCredentialUnique(IsCredentialIdUniqueToUserParams credentialIdUserParams)
    {
        bool result = true;
        var credentialIdUserParamsCredentialId = credentialIdUserParams.CredentialId;
        var base64CredId = Convert.ToBase64String(credentialIdUserParams.CredentialId);
        MongoClient dbClient = new MongoClient("PLACE YOUR MONGO CONNECTION STRING HERE");
        IMongoDatabase database = dbClient.GetDatabase("users");

        var collection = database.GetCollection<BsonDocument>("appusers");
        var filter = new BsonDocument {
                    {"CredentialId", base64CredId},
                    };
        var users = collection.Find(filter).FirstOrDefault();
        if (users != null)
            result = false;

        return await Task.FromResult(result);
    }

    //Sign In Part
    [EnableCors("PasswordlessCorsPolicy")]
    [Route("[action]")]
    [HttpPost]
    public async Task<JsonResult> MakeAssertionAsync([FromBody] Object clientResponse)
    {
        var jsonString = System.Text.Json.JsonSerializer.Serialize(clientResponse);
        var rootObject = JsonConvert.DeserializeObject<AuthenticatorAssertionRawResponse>(jsonString);
        var httpContext = _accessor.HttpContext;
        try
        {
            var jsonOptions = _cache.Get("fido2.assertionOptions");
            var options = AssertionOptions.FromJson(jsonOptions.ToString());
            var existinguser = await GetUserByCredentials(rootObject.Id);
            var credential = JsonConvert.DeserializeObject<StoredCredential>(existinguser.PasswordlessPublicKey);
            var result1 = await fido2.MakeAssertionAsync(rootObject, options, credential.PublicKey, credential.SignatureCounter,
                                                           args => Task.FromResult(credential.UserHandle.SequenceEqual(args.UserHandle)));

            await UpdateCounter(existinguser, credential, result1.Counter);

            returnedResult result = new returnedResult();
            result.firstName = JsonConvert.SerializeObject(existinguser.FirstName);
            result.lastName = JsonConvert.SerializeObject(existinguser.LastName);
            result.status = JsonConvert.SerializeObject(result1.Status);
            result.data = JsonConvert.SerializeObject(result1);

            return new JsonResult(result);
        }
        catch (Exception e)
        {
            return new JsonResult(new AssertionVerificationResult { Status = "error", ErrorMessage = e.Message });
        }
    }

    private async Task UpdateCounter(User user, StoredCredential credential, uint resultCounter)
    {
        credential.SignatureCounter = resultCounter;

        var filter = Builders<BsonDocument>.Filter.Eq("CredentialId", user.CredentialId);
        var update = Builders<BsonDocument>.Update.Set("PasswordlessPublicKey", JsonConvert.SerializeObject(credential));

        MongoClient dbClient = new MongoClient("PLACE YOUR MONGO CONNECTION STRING HERE");
        IMongoDatabase database = dbClient.GetDatabase("users");
        var collection = database.GetCollection<BsonDocument>("appusers");
        collection.UpdateOne(filter, update);
    }
    private async Task<User> GetUserByCredentials(byte[] credentialId)
    {
        MongoClient dbClient = new MongoClient("PLACE YOUR MONGO CONNECTION STRING HERE");
        IMongoDatabase database = dbClient.GetDatabase("users");

        var collection = database.GetCollection<BsonDocument>("appusers");
        var filter = new BsonDocument {
                    {"CredentialId", Convert.ToBase64String(credentialId)},
                    };
        var userFound = collection.Find(filter).FirstOrDefault();

        if (userFound == null)
            throw new ArgumentException("Username was not registered.Please register first.");

        User retUser = new User();
        retUser.PasswordlessPublicKey = userFound["PasswordlessPublicKey"].ToString();
        retUser.Email = userFound["Email"].ToString();
        retUser.CredentialId = userFound["CredentialId"].ToString();
        retUser.FirstName = userFound["FirstName"].ToString();
        retUser.LastName = userFound["LastName"].ToString();

        return retUser;
    }
}
