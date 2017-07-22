// This is a small node server which sends emails to new users containing their temporary password

// pouchdb packages
const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-find'));
PouchDB.plugin(require('pouchdb-authentication'));
var remoteDb = new PouchDB('http://localhost:5984/remotedb');

// "cryptography" packages
var generator = require('generate-password');
var md5 = require('md5');

// mailgun setup 
var api_key = 'key-551fd7590f3d18b964adcf7bbdc09868';
var domain = 'sandbox292f29193e934d1d817a0a7d1a9f4174.mailgun.org';
var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});


var FROM = 'Vit-elec <postmaster@sandbox292f29193e934d1d817a0a7d1a9f4174.mailgun.org>';

var createAttachmentFromBase64 = function (filename, b64) {
    if (!filename || !b64)
    {
        return;
    }
    var pos = b64.indexOf('base64,');
    if (pos !== -1)
    {
        b64 = b64.substr(pos + 7);
    }
    var buf = new Buffer(b64, 'base64');

    var mailgunAttach = new mailgun.Attachment({data: buf, filename: filename});

    return mailgunAttach;
};


var fetchAuthenticationEmail = function() {
  remoteDb.createIndex({
  index: {
    fields: ["type"]
  }
}).then(function () {
    console.log("HERE");
  return remoteDb.find({
    selector: {type: "authenticationEmail"}
  }).then(function (emailObject) {
      console.log("inside succes")
        console.log(emailObject);
        
        for (i in emailObject.docs){
          
          changePassword(emailObject.docs[i], generator.generate({length: 5, numbers: true}), function(password){      
          var recipient = 'florian.schustek@supelec.fr';
          var data = {
            from: FROM,
            to: recipient,
            subject: 'Identifiants',
            text: "Bonjour, un compte vous a été créé, votre identifiant est "+recipient+".\n Votre mot de passe par défaut est: "+password+", veillez à le changer"
          };
          mailgun.messages().send(data, function (error, body) {
          if(error)
          {
          console.log(error);
        }});
        
          },function(err){console.log("error2");console.log(err);})
          remoteDb.remove(emailObject.docs[i]);

        }
        
      }).catch(function (err) {
          console.log("inside err")
          console.log("error3")
      console.log(err);
      });
  });  
};

var fetchEstimateEmail = function() {
  remoteDb.createIndex({
  index: {
    fields: ["type"]
  }
}).then(function () {
    console.log("HERE");
  return remoteDb.find({
    selector: {type: "estimateEmail"}
  }).then(function (emailObject) {
        
        for (i in emailObject.docs){
          remoteDb.find({
            selector: {_id: emailObject.docs[i].estimateId}
          }).then(function (estimateData) {
              var estimate = estimateData.docs[0];

              var recipient = estimate.mail;
              var data = {
                from: FROM,
                to: recipient,
                subject: 'Devis VitElec',
                text: 'Bonjour, un devis Vit Elec vous a été envoyé. Retrouvez le en pièce jointe.',
                attachment: createAttachmentFromBase64('Devis.pdf', estimate.pdf)
              };console.log(data);
              mailgun.messages().send(data, function (error, body) {console.log(error, body);
              if(error)
              {
              console.log(error);
            }});
            
              remoteDb.remove(emailObject.docs[i]);
          });

        }
        
      }).catch(function (err) {
          console.log("inside err")
          console.log("error3")
      console.log(err);
      });
  });  
};


// this code is executed every 15 seconds and fetches the latest "authenticationEmail" objects from couchdb and then sends an email to the user with a temporary password and changes his password
// in couchdbs _user database and in remotedb (for offline login). The "authenticationEmail" object is then deleted.
setInterval(function(){
     console.log("Hello"); 
     fetchAuthenticationEmail();
     fetchEstimateEmail();
}, 1500);




//helper function changePassword which changes the password in the _user database but also in the remoteDb database to allow for offline login
      function changePassword(authenticationEmail, newPassword, successCb, errorCb){
        remoteDb.changePassword(authenticationEmail.emailAddress, newPassword, function(err, response) {
  if (err) {
    console.log("error4")
    console.log(err);
    errorCb(err);
    if (err.name === 'not_found') {
      // typo, or you don't have the privileges to see this user
    } else {
      // some other error
    }
  } else {
    // response is the user update response
    // {
    //   "ok": true,
    //   "id": "org.couchdb.user:spiderman",
    //   "rev": "2-09310a62dcc7eea42bf3d4f67e8ff8c4"
    // }
          console.log(authenticationEmail)

         // user.sync_rev = md5.createHash(newPassword || 'xy256u9i')
          delete newPassword;

                remoteDb.get(authenticationEmail.userId, function(err, user) {
          if (err) { 
            errorCb(err);
            console.log(err);
          }
          else{
          // handle doc
                      user.sync_rev = md5(newPassword || 'xy256u9i')
            remoteDb.put(user, function callback(err, result) {
            if (!err) {
              console.log(user);
            }
            else{
              console.log("error1")
              console.log(err);
            }
          });
          }
        });

    successCb(newPassword);
    console.log(response);

    //update password hash locally

  }
})
      }
