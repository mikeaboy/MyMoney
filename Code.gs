/**
 * 私人帳務整合系統 - Google Apps Script 後端服務 (支援真實 Google OAuth 彈窗驗證 + postMessage 回傳 + Google Drive 自動儲存)
 * 您的部署網址：https://script.google.com/macros/s/AKfycbzNkQtqYOaXGeP9XJkUZdCguh_bOUP8aOirzGNb0N0dNkvg9RMp4u75hyK_Si1aU2LwyQ/exec
 */

const DATA_FILE_NAME = "private_wealth_manager_data.json";

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  // 1. 若以 ?action=json 呼叫，回傳 JSON 格式的雲端帳務與真實使用者資訊
  if (params.action === "json") {
    var jsonResult = apiGetUserData();
    return ContentService.createTextOutput(JSON.stringify(jsonResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. 當前端點擊「使用 Google 帳號登入」開啟真實 Google OAuth 彈窗 (?popup=1)
  //    通過 Google 官方驗證後，將真實 Google 帳號與 Drive 帳務透過 postMessage 傳回主視窗並自動關閉彈窗
  if (params.popup === "1") {
    var authResult = apiGetUserData();
    var popupHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Google 帳號驗證成功</title></head>' +
      '<body style="background:#0f1216;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">' +
      '<div style="text-align:center;padding:24px;">' +
      '<div style="font-size:18px;font-weight:bold;margin-bottom:8px;">✓ Google 帳號驗證成功</div>' +
      '<div style="font-size:13px;color:#8b95a5;">正在將您的專屬帳務同步回主畫面，視窗即將自動關閉...</div>' +
      '</div>' +
      '<script>' +
      'var payload = ' + JSON.stringify(authResult) + ';' +
      'try {' +
      '  if (window.opener) {' +
      '    window.opener.postMessage({ type: "GAS_OAUTH_SUCCESS", payload: payload }, "*");' +
      '    setTimeout(function() { window.close(); }, 350);' +
      '  } else {' +
      '    window.location.replace("https://script.google.com/macros/s/AKfycbzNkQtqYOaXGeP9XJkUZdCguh_bOUP8aOirzGNb0N0dNkvg9RMp4u75hyK_Si1aU2LwyQ/exec");' +
      '  }' +
      '} catch (err) {}' +
      '</script></body></html>';

    return HtmlService.createHtmlOutput(popupHtml)
      .setTitle("Google 帳號驗證成功")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 3. 一般開啟：回傳完整 index.html 介面
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("我的帳務")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var contents = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
  var res = apiSaveUserData(contents);
  return ContentService.createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

function getRealGoogleUserInfo() {
  var email = "";
  var name = "";
  var picture = "";
  var webAppUrl = "https://script.google.com/macros/s/AKfycbzNkQtqYOaXGeP9XJkUZdCguh_bOUP8aOirzGNb0N0dNkvg9RMp4u75hyK_Si1aU2LwyQ/exec";

  try {
    webAppUrl = ScriptApp.getService().getUrl() || webAppUrl;
  } catch (e) {}

  try {
    email = Session.getActiveUser().getEmail() || "";
  } catch (e) {}

  try {
    var token = ScriptApp.getOAuthToken();
    var res = UrlFetchApp.fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      var info = JSON.parse(res.getContentText());
      email = info.email || email;
      name = info.name || info.given_name || "";
      picture = info.picture || "";
    }
  } catch (e) {}

  if (!email) {
    try {
      var token2 = ScriptApp.getOAuthToken();
      var res2 = UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink)", {
        headers: { Authorization: "Bearer " + token2 },
        muteHttpExceptions: true
      });
      if (res2.getResponseCode() === 200) {
        var about = JSON.parse(res2.getContentText());
        if (about && about.user) {
          email = about.user.emailAddress || email;
          name = about.user.displayName || name;
          picture = about.user.photoLink || picture;
        }
      }
    } catch (e) {}
  }

  return {
    email: email || "已授權 Google 帳戶",
    name: name || (email ? email.split("@")[0] : "Google 使用者"),
    picture: picture || "",
    webAppUrl: webAppUrl
  };
}

function apiGetUserData() {
  var userInfo = getRealGoogleUserInfo();
  try {
    var files = DriveApp.getFilesByName(DATA_FILE_NAME);
    if (files.hasNext()) {
      var file = files.next();
      var content = file.getBlob().getDataAsString("UTF-8");
      if (content && content.trim()) {
        return {
          success: true,
          user: userInfo,
          email: userInfo.email,
          isNewUser: false,
          fileId: file.getId(),
          lastUpdated: file.getLastUpdated().toISOString(),
          data: JSON.parse(content)
        };
      }
    }
    return {
      success: true,
      user: userInfo,
      email: userInfo.email,
      isNewUser: true,
      data: null
    };
  } catch (err) {
    return {
      success: false,
      user: userInfo,
      email: userInfo.email,
      error: err.toString()
    };
  }
}

function apiSaveUserData(dataJsonString) {
  var userInfo = getRealGoogleUserInfo();
  try {
    var files = DriveApp.getFilesByName(DATA_FILE_NAME);
    var targetFile = null;
    if (files.hasNext()) {
      targetFile = files.next();
      targetFile.setContent(dataJsonString);
    } else {
      targetFile = DriveApp.createFile(DATA_FILE_NAME, dataJsonString, MimeType.PLAIN_TEXT);
      targetFile.setDescription("我的帳務 - 個人資產管理系統雲端同步檔");
    }
    return {
      success: true,
      user: userInfo,
      email: userInfo.email,
      fileId: targetFile.getId(),
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      user: userInfo,
      email: userInfo.email,
      error: err.toString()
    };
  }
}