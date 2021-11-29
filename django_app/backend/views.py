from django.shortcuts import render
import requests
import json
from django.http import JsonResponse, HttpResponse, Http404
import json
from django.views.decorators.csrf import csrf_exempt
import json
import time
import logging
import os

from .mist_lib.sites import Sites
from .mist_lib.stats import SiteStats, AppStats, ClientStats

try:
    from .config import google_api_key
except:
    google_api_key = os.environ.get("GOOGLE_API_KEY", default="")

try:
    from .config import app_disclaimer
except:
    app_disclaimer = os.environ.get("APP_DISCLAIMER", default="")

try:
    from .config import app_github_url
except:
    app_github_url = os.environ.get("APP_GITHUB_URL", default="")

try:
    from .config import app_docker_url
except:
    app_docker_url = os.environ.get("APP_DOCKER_URL", default="")


##########
# Site Stats
@csrf_exempt
def get_site_stats(request):
    if request.method == 'POST':
        response = SiteStats().get_site_stats(request.body)
        return JsonResponse(status=response["status"], data=response["data"])
    else:
        return Http404

@csrf_exempt
def get_sites_clients(request):
    if request.method == 'POST':
        response = SiteStats().get_site_clients(request.body)
        return JsonResponse(status=response["status"], data=response["data"])
    else:
        return Http404

##########
# App Stats
##########
# Client Stats
##########
# Sites


@csrf_exempt
def get_sites(request):
    if request.method == 'POST':
        response = Sites().get_sites(request.body)
        return JsonResponse(status=response["status"], data=response["data"])
    else:
        return Http404
@csrf_exempt
def get_site_wlans(request):
    if request.method == 'POST':
        response = Sites().get_site_wlans(request.body)
        return JsonResponse(status=response["status"], data=response["data"])
    else:
        return Http404

##########
# LOGIN


def _get_self(request, host, method, headers={}, cookies=None):
    if cookies == None:
        cookies_dict = None
    else:
        cookies_dict = cookies.get_dict()
    url = "https://%s/api/v1/self" % (host)
    resp = requests.get(url, headers=headers, cookies=cookies)
    data = resp.json()
    return JsonResponse({"host": host, "data": data, "method": method, "headers": headers, "cookies":  cookies_dict})


@csrf_exempt
def login(request):
    if request.method == 'POST':
        body_unicode = request.body.decode('utf-8')
        body = json.loads(body_unicode)
        if "host" in body:

            if "token" in body:
                headers = {"Authorization": "Token " +
                           body["token"], 'Content-Type': "application/json"}
                return _get_self(request, body["host"], "token", headers=headers)

            elif "email" in body and "password" in body:
                url = "https://%s/api/v1/login" % (body["host"])
                data = {"email": body["email"], "password": body["password"]}
                if "two_factor" in body:
                    data["two_factor"] = body["two_factor"]
                headers = {'Content-Type': "application/json"}
                resp = requests.post(url, json=data, headers={})

                if resp.status_code == 200:
                    cookies = resp.cookies
                    return _get_self(request, body["host"], "username", headers=headers, cookies=cookies)
                else:
                    return JsonResponse(status=400, data={"message": "authentication failed"})
            elif "email" in body:
                return JsonResponse(status=401, data={"message": "authentication information are missing"})
            elif "password" in body:
                return JsonResponse(status=401, data={"message": "authentication information are missing"})
            else:
                return JsonResponse(status=500, data={"message": "authentication information are missing"})
        else:
            return JsonResponse(status=500, data={"message": "host missing"})
    else:
        return JsonResponse(status=400, data={"message": "not allowed"})


@csrf_exempt
def disclaimer(request):
    if request.method == "GET":
        return JsonResponse({
            "disclaimer": app_disclaimer,
            "github_url": app_github_url,
            "docker_url": app_docker_url
        })


# Google API
@csrf_exempt
def gap(request):
    if request.method == "GET":
        return JsonResponse({"gap": google_api_key})


@csrf_exempt
def script(request):
    if request.method == "GET":
        data = """
var script = document.createElement('script');
script.src = 'https://maps.googleapis.com/maps/api/js?key={0}&callback=initMap';
script.defer = true;

window.initMap = function() {{
}};

// Append the 'script' element to 'head'
document.head.appendChild(script);
        """.format(google_api_key)
        return HttpResponse(data, content_type="application/javascript")
