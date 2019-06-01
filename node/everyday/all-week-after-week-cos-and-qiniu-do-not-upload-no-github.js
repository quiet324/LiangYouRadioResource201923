const Xray = require('x-ray');
const x = Xray();
const fs = require('fs');
const download = require('download');
var shell = require('shelljs');
var dateFormat = require('dateformat');
var async = require('async');
var downloadFileSync = require('download-file-sync');
var schedule = require('node-schedule');
var _ = require('lodash');
var COS = require('cos-nodejs-sdk-v5');
var qiniu = require('qiniu');

var deasync = require('deasync');

var rule = new schedule.RecurrenceRule();
// rule.dayOfWeek = [0, new schedule.Range(4, 6)];
rule.hour = [1, 2, 6, 9, 17, 21];
rule.minute = 4;




var mkdirp = require('mkdirp');


// var moment = require('moment');
var moment = require('moment-timezone');

moment.tz.setDefault('Asia/Shanghai');

var taskRunningTimes = 1;

var token = JSON.parse(fs.readFileSync('.token', 'utf8')).token;
var SecretId = JSON.parse(fs.readFileSync('.SecretId', 'utf8')).SecretId;
var SecretKey = JSON.parse(fs.readFileSync('.SecretKey', 'utf8')).SecretKey;


var QAccessKey = JSON.parse(fs.readFileSync('.qaccessKey', 'utf8')).accessKey;
var QSecretKey = JSON.parse(fs.readFileSync('.qsecretKey', 'utf8')).SecretKey;
var mac = new qiniu.auth.digest.Mac(QAccessKey, QSecretKey);
var options = {
    scope: 'dailyjson',
    expires: 7200 * 24 * 365
};
var putPolicy = new qiniu.rs.PutPolicy(options);
var uploadToken = putPolicy.uploadToken(mac);

var config = new qiniu.conf.Config();
// 空间对应的机房
config.zone = qiniu.zone.Zone_z2;
// 是否使用https域名
//config.useHttpsDomain = true;
// 上传是否使用cdn加速
//config.useCdnDomain = true;


var cos = new COS({
    AppId: '1253798207',
    SecretId: SecretId,
    SecretKey: SecretKey
});

// var j = schedule.scheduleJob('0 * * * * *', function() { // "Runs job every minute"

// var j = schedule.scheduleJob('*/5 * * * *', function() { // "Runs job every 5 minute"
var j = schedule.scheduleJob(rule, function() { // rule hour at 5 minutes

    var lastYearWeekValue = "";

    var year = moment().format('YYYY');
    // var week = moment().format('WW') + moment().unix();
    var week = moment().format('ww');
    var repoName = "LiangYouRadioResource" + year + week;

    var jsonFilesForCOS = [];
    var jsonFilesForCOSDone = [];

    var audioFilesForCOS = [];
    var audioFilesForCOSDone = [];

    var jsonFilesForCOSFileName = '../operate/jsonFilesForCOS.json';
    var jsonFilesForCOSFileNameDone = '../operate/jsonFilesForCOSDone.json';

    var audioFilesForCOSFileName = '../operate/audioFilesForCOS.json';
    var audioFilesForCOSFileNameDone = '../operate/audioFilesForCOSDone.json';


    if (fs.existsSync(jsonFilesForCOSFileName)) { //
        jsonFilesForCOS = JSON.parse(fs.readFileSync(jsonFilesForCOSFileName, 'utf8'));
    }

    if (fs.existsSync('week.json')) {

        lastYearWeekValue = JSON.parse(fs.readFileSync('week.json', 'utf8')).week;

    } else {
        fs.writeFileSync('week.json', JSON.stringify({ "week": year + week }));
        lastYearWeekValue = year + week;
    }

    if ((year + week) !== lastYearWeekValue) {
        j.cancel();

        fs.writeFileSync('week.json', JSON.stringify({ "week": year + week }));

        var createReops = "curl -u 'quiet324:" + token + "' https://api.github.com/user/repos -d '{\"name\":\"\'" + repoName + "\'\"}' ";

        if (shell.exec(createReops).code !== 0) {
            shell.echo('Error: Git create failed');
            shell.exit(1);
        }

        shell.mkdir('-p', '../../../' + repoName);
        shell.cp('../../artist.json', '../../../' + repoName);
        shell.cp('../../.gitignore', '../../../' + repoName);

        if (shell.exec('rsync -r --exclude=.git ../../node ../../../' + repoName).code !== 0) {
            shell.echo('Error: rsync failed');
            shell.exit(1);
        }

        shell.rm('-rf', '../../**/*.mp3');
        shell.rm('-rf', '../../**/.*');

        shell.cd('../../../' + repoName);

        if (shell.exec('echo "' + repoName + '" >> README.md').code !== 0) {
            shell.echo('Error: add README.md failed');
            shell.exit(1);
        }

        if (shell.exec('git init').code !== 0) {
            shell.echo('Error: git init failed');
            shell.exit(1);
        }

        if (shell.exec('git add README.md').code !== 0) {
            shell.echo('Error: git add README.md failed');
            shell.exit(1);
        }

        if (shell.exec('git commit -m "first commit"').code !== 0) {
            shell.echo('Error: git commit -m "first commit" failed');
            shell.exit(1);
        }

        if (shell.exec('git remote add origin git@github.com:quiet324/' + repoName + '.git').code !== 0) {
            shell.echo('Error: git remote add origin failed');
            shell.exit(1);
        }

        if (shell.exec('git push -u origin master').code !== 0) {
            shell.echo('Error: git push -u origin master failed');
            shell.exit(1);
        }

        shell.cd('node/everyday');

        if (shell.exec('node all-week-after-week-cos-and-qiniu-do-not-upload-no-github.js').code !== 0) {
            shell.echo('Error: node all.js failed');
            shell.exit(1);
        }

        return;
    }

    // var j = schedule.scheduleJob('0 5 * * * *', function() { // // "Runs job every 5 minute"
    // var j = schedule.scheduleJob('0 0 * * * *', function() { //// "Runs job every hour"
    var now = moment().format('MMMM Do YYYY, h:mm:ss a');
    console.log(now + year + week + ' taskRunningTimes:' + taskRunningTimes++);
    var results = JSON.parse(fs.readFileSync('../../artist.json', 'utf8'));
    results.forEach(function(artist) {
        // for (i = 0; i < results.length; i++) {
        //     var artist = results[i];

        // || mArtist.getId() == 49
        // || mArtist.getId() == 9
        // || mArtist.getId() == 33
        // || mArtist.getId() == 28
        // || mArtist.getId() == 45
        // || mArtist.getId() == 34
        // || mArtist.getId() == 4)

        if (artist.id === 49 ||
            artist.id === 9 ||
            artist.id === 33 ||
            artist.id === 28 ||
            artist.id === 45 ||
            artist.id === 34 ||
            artist.id === 4) { // 空中门训
            return;
        }

        // var done = false;

        var outerSync = true;



        x('http://txly2.net/' + artist.shortName, 'tbody tr', [{
                "time": '.ss-title a',
                "title": '.ss-title p',
                "downUrl": '.ss-dl a@href'
            }])
            // .write('results.json')
            (function(err, audios) {

                if (err === null) {
                    audios.forEach(function(audio) {
                        // for (i = 0; i < audios.length; i++) {
                        // var audio = audios[i];
                        var index = audio.downUrl.indexOf('?');
                        var sub = audio.downUrl.substring(0, index);
                        var lastIndex = audio.downUrl.lastIndexOf('/');
                        var fileName = sub.substring(lastIndex + 1);
                        audio.downUrl = sub;
                        audio.time = audio.time.substring(audio.time.lastIndexOf('-') + 1);
                        console.log(moment().format('MMMM Do YYYY, h:mm:ss a') + artist.name + audio.time)
                            // var today = dateFormat(new Date(), "yyyymmdd");
                        var today = moment().format("YYYYMMDD");
                        var yesterday = moment().add(-1, 'days').format("YYYYMMDD");

                        if (audio.time === today || (audio.time === yesterday && artist.id === 15)) {
                            // if (audio.time === yesterday) {

                            var file = '../../' + artist.shortName + '/' + fileName;

                            if (!fs.existsSync(file)) { //
                                // Do something

                                // console.log(moment().format('MMMM Do YYYY, h:mm:ss a') + "downloading... " + audio.downUrl);

                                // var data = require('child_process').execFileSync('curl', ['-L', audio.downUrl]);

                                // var data = require('child_process').execFileSync('curl', ['--silent', '-L', audio.downUrl]);
                                // var data = downloadFileSync(audio.downUrl)

                                //mkdirp.sync('../../' + artist.shortName);

                                //fs.writeFileSync('../../' + artist.shortName + '/' + fileName, data);



                                var forCosAudioFile = {};
                                forCosAudioFile.fileName = file;

                                if (!_.some(audioFilesForCOS, forCosAudioFile)) {
                                    audioFilesForCOS.push(forCosAudioFile);
                                    fs.writeFileSync(audioFilesForCOSFileName, JSON.stringify(audioFilesForCOS, null, '\t'));
                                }


                                var commitTag = artist.shortName + audio.time

                                var year = moment().format('YYYY');
                                var week = moment().format('ww');

                                audio.duration = artist.duration;
                                audio.size = artist.size;
                                audio.artistId = artist.id;
                                audio.artistName = artist.name;
                                audio.path = "https://rawcdn.githack.com/quiet324/LiangYouRadioResource" + year + week + "/" + commitTag + "/" + artist.shortName + "/" + fileName;
                                audio.id = artist.id * 1000000 + parseInt(audio.time.substring(2), 10);

                                if (fs.existsSync("./" + artist.shortName + audio.time + ".json")) {

                                    return;
                                }

                                fs.writeFileSync("./" + artist.shortName + audio.time + ".json", JSON.stringify(audio, null, '\t'));


                                // Save To Three Month Json Files
                                var all_artist_songs = JSON.parse(fs.readFileSync("../operate/all_" + artist.shortName + '_songs.json', 'utf8'));

                                // if (all_artist_songs.indexOf(audio) === -1) {

                                if (!_.some(all_artist_songs, audio)) {
                                    all_artist_songs.push(audio);
                                    if (artist.shortName !== 'aw' &&
                                        artist.shortName !== 'ba' &&
                                        artist.shortName !== 'bs' &&
                                        artist.shortName !== 'cs' &&
                                        artist.shortName !== 'cwa' &&
                                        artist.shortName !== 'gl' &&
                                        artist.shortName !== 'gsa' &&
                                        artist.shortName !== 'hd' &&
                                        artist.shortName !== 'hw' &&
                                        artist.shortName !== 'ls' &&
                                        artist.shortName !== 'mc' &&
                                        artist.shortName !== 'mj' &&
                                        artist.shortName !== 'mm' &&
                                        artist.shortName !== 'mp' &&
                                        artist.shortName !== 'rt' &&
                                        artist.shortName !== 'sa' &&
                                        artist.shortName !== 'sg' &&
                                        artist.shortName !== 'tm' &&
                                        artist.shortName !== 'ug' &&
                                        artist.shortName !== 'vc' &&
                                        artist.shortName !== 'wa' &&
                                        artist.shortName !== 'wf' &&
                                        artist.shortName !== 'yp' &&
                                        artist.shortName !== 'hp' &&
                                        artist.shortName !== 'wn') {
                                        all_artist_songs.shift();

                                    }
                                }


                                fs.writeFileSync("../operate/all_" + artist.shortName + audio.time + "_songs.json", JSON.stringify(all_artist_songs, null, '\t'));
                                fs.writeFileSync("../operate/all_" + artist.shortName + "_songs.json", JSON.stringify(all_artist_songs, null, '\t'));

                                var forCosFile = {};
                                forCosFile.fileName = "../operate/all_" + artist.shortName + audio.time + "_songs.json";

                                if (!_.some(jsonFilesForCOS, forCosFile)) {
                                    jsonFilesForCOS.push(forCosFile);
                                    fs.writeFileSync(jsonFilesForCOSFileName, JSON.stringify(jsonFilesForCOS, null, '\t'));
                                }



                                if (!shell.which('git')) {
                                    shell.echo('Sorry, this script requires git');
                                    shell.exit(1);
                                }

                                if (shell.exec('git add ../../.').code !== 0) {
                                    shell.echo('Error: Git add failed');
                                    shell.exit(1);
                                }

                                if (shell.exec('git commit -m "Auto-commit"').code !== 0) {
                                    shell.echo('Error: Git commit failed');
                                    shell.exit(1);
                                }

                                if (shell.exec('git tag ' + artist.shortName + audio.time).code !== 0) {
                                    shell.echo('Error: Git tag failed');
                                    shell.exit(1);
                                }

                                if (shell.exec('git push').code !== 0) {
                                    shell.echo('Error: Git push failed');
                                    shell.exit(1);
                                }

                                if (shell.exec('git push --tags').code !== 0) {
                                    shell.echo('Error: Git push tags failed');
                                    shell.exit(1);
                                }


                            } else {
                                console.log(file + " exist");
                            }



                        }
                    });





                }

                // var done = true;
                outerSync = false;

            });

        // require('deasync').loopWhile(function() { return !done; });

        while (outerSync) { require('deasync').sleep(2000); }

    });

});
