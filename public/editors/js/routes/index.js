GetParameters

import { GetParameters } from "./constants.js"
import { GetCookie, SetCookies, hoursToKeep } from "./setCookie.js"

  const user = GetParameters(window.location.href).get("e")

  const GetUserCookie = GetCookie("editor")
  if(user && user != ""){

  if(GetUserCookie){
  window.location.href = "Dashboard/";
  }else{
    SetCookies("editor", user, hoursToKeep)
  window.location.href = "Dashboard/";

  }

  }else{
  window.location.href = "Dashboard/";

  } 