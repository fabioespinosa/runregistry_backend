const exec = require('child_process').exec;
let { Cookie, CookieMap, CookieError } = require('cookiefile');

const bash_script2 = `kinit f.e@CERN.CH -k -t /srv/runregistry_node/runregistry.keytab && cern-get-sso-cookie -u https://cmsoms.cern.ch/ -o ${__dirname}/cookie.txt --krb`;
const bash_script = `cern-get-sso-cookie -u https://cmsoms.cern.ch/ -o ${__dirname}/cookie.txt --krb`;
// This will get a cookie to make an authenticated request to CMS OMS. It will not run on a machine that is not in openstack.
exports.get_cookie = () =>
    new Promise((resolve, reject) => {
        exec(bash_script2, (error, stdout, stderr) => {
            if (error !== null) {
                console.log(`exec error: ${error}`);
                console.log(stdout);
                console.log(stderr);
                reject(error);
            }
            let cookieFile = new CookieMap(`${__dirname}/cookie.txt`);
            let cookie = '';
            // Transform Netscape format cookie to string cookie:
            for (const [key, value] of cookieFile.entries()) {
                cookie += `${key}=${value.value};`;
            }
            resolve(cookie);
        });
    });
